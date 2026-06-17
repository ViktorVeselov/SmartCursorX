import { spawn, ChildProcess, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { secureStore } from '../../secureStore'
import {
  FinetuneBackend,
  BackendCapability,
  HardwareSpec,
  FinetuneOptions,
  TrainingEvent,
  DEFAULT_FINETUNE_OPTIONS,
  BackendAvailability,
  BYTES_PER_GB,
  DDP_MAX_GPUS,
  TORCHRUN_MASTER_PORT,
  STOP_TIMEOUT_MS,
  PYTHON_IMPORT_TIMEOUT_MS,
  runCommand,
} from './BaseFinetuneBackend'

export class PythonBackend implements FinetuneBackend {
  readonly name = 'Python (PyTorch)'
  readonly capabilities: BackendCapability[] = ['python_cuda', 'python_mps', 'python_cpu']
  private process: ChildProcess | null = null
  private wasStoppedIntentionally = false

  private get pythonCmd(): string {
    return process.platform === 'win32' ? 'python' : 'python3'
  }

  private get scriptDir(): string {
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'scripts')
      }
    } catch {}
    return path.join(process.cwd(), 'scripts')
  }

  async isAvailable(): Promise<BackendAvailability> {
    const required = [
      { pkg: 'torch', label: 'PyTorch' },
      { pkg: 'transformers', label: 'Transformers' },
      { pkg: 'peft', label: 'PEFT (LoRA)' },
    ]
    const optional = [
      { pkg: 'bitsandbytes', label: 'BitsAndBytes (QLoRA 4-bit)' },
    ]

    const missing: string[] = []

    // Check Python is reachable
    const pythonCheck = await runCommand(`${this.pythonCmd} --version`)
    if (!pythonCheck.ok) {
      return {
        available: false,
        error: `Python not found. Install Python 3.8+ and add it to PATH.`,
        missing: ['Python'],
      }
    }

    // Check required packages
    for (const check of required) {
      const result = await runCommand(`${this.pythonCmd} -c "import ${check.pkg}"`, PYTHON_IMPORT_TIMEOUT_MS)
      if (!result.ok) missing.push(check.label)
    }

    // Check optional packages (warn but don't block)
    const missingOptional: string[] = []
    for (const check of optional) {
      const result = await runCommand(`${this.pythonCmd} -c "import ${check.pkg}"`, PYTHON_IMPORT_TIMEOUT_MS)
      if (!result.ok) missingOptional.push(check.label)
    }

    if (missing.length > 0) {
      const installCmd = missing.map(p => p.toLowerCase().replace(/ \(.*\)/, '')).join(' ')
      return {
        available: false,
        error: `Missing required packages: ${missing.join(', ')}. Install with: pip install ${installCmd}`,
        missing,
        details: missingOptional.length > 0
          ? `Optional (for 4-bit QLoRA): ${missingOptional.join(', ')}. Install with: pip install bitsandbytes`
          : undefined,
      }
    }

    // Check PyTorch GPU support
    let gpuNote = ''
    const gpuCheck = await runCommand(
      `${this.pythonCmd} -c "import torch; print('cuda' if torch.cuda.is_available() else 'mps' if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available() else 'cpu')"`
    )
    if (gpuCheck.ok && gpuCheck.stdout.trim() === 'cpu') {
      gpuNote = 'PyTorch is CPU-only. Training will be slow. For GPU support, install PyTorch with CUDA/ROCm.'
    }

    return {
      available: true,
      details: missingOptional.length > 0
        ? `Optional: ${missingOptional.join(', ')} not installed (4-bit QLoRA unavailable). Install with: pip install bitsandbytes`
        : gpuNote || undefined,
    }
  }

  async detectHardware(): Promise<HardwareSpec> {
    const spec: HardwareSpec = {
      gpuAvailable: false,
      gpuName: 'CPU',
      vramGB: 0,
      cudaCores: 0,
      cpuCores: require('os').cpus().length,
      ramGB: Math.round(require('os').totalmem() / BYTES_PER_GB),
      backendType: 'python_cpu',
      numGPUs: 0,
      isAMD: false,
    }

    const detectScript = `${this.pythonCmd} -c "
import torch, sys
if not torch.cuda.is_available():
    sys.exit(0)
has_hip = hasattr(torch.version, 'hip') and torch.version.hip is not None
is_amd = has_hip or 'AMD' in torch.cuda.get_device_name(0) or 'Radeon' in torch.cuda.get_device_name(0)
n = torch.cuda.device_count()
name = torch.cuda.get_device_name(0)
mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
hip_ver = torch.version.hip if has_hip else ''
print(f'{name}|{mem:.0f}|{n}|{int(is_amd)}|{hip_ver}')
"`

    const cudaResult = await runCommand(detectScript, 15000)
    if (cudaResult.ok && cudaResult.stdout) {
      const parts = cudaResult.stdout.split('|')
      if (parts[0] && parts[0] !== '') {
        spec.gpuAvailable = true
        spec.gpuName = parts[0]
        spec.vramGB = parseInt(parts[1]) || 0
        spec.numGPUs = parseInt(parts[2]) || 1
        spec.isAMD = parts[3] === '1'
        spec.rocmVersion = parts[4] || undefined
        spec.backendType = spec.isAMD ? 'python_rocm' : 'python_cuda'
      }
    } else {
      // Fallback: check for MPS (Apple Silicon)
      const mpsResult = await runCommand(
        `${this.pythonCmd} -c "import torch; v='MPS' if torch.backends.mps.is_available() else ''; print(v)"`,
        10000
      )
      if (mpsResult.ok && mpsResult.stdout.trim() === 'MPS') {
        spec.gpuAvailable = true
        spec.gpuName = 'Apple Silicon (MPS)'
        spec.vramGB = spec.ramGB
        spec.numGPUs = 1
        spec.isAMD = false
        spec.backendType = 'python_mps'
      }
    }

    return spec
  }

  async prepareEnvironment(options: FinetuneOptions): Promise<void> {
    const outputDir = options.outputDir || this.defaultOutputDir(options)
    fs.mkdirSync(outputDir, { recursive: true })

    const scriptPath = path.join(this.scriptDir, 'finetune_qlora.py')
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Training script not found: ${scriptPath}`)
    }
  }

  private buildScriptArgs(
    options: FinetuneOptions,
    merged: FinetuneOptions,
    isAMD: boolean
  ): string[] {
    const args = [
      '--dataset', merged.datasetPath,
      '--output-dir', merged.outputDir || this.defaultOutputDir(options),
      '--quantization', merged.quantization,
      '--learning-rate', String(merged.learningRate),
      '--num-epochs', String(merged.numEpochs),
      '--batch-size', String(merged.batchSize),
      '--max-seq-length', String(merged.maxSeqLength),
      '--lora-rank', String(merged.loraRank),
      '--lora-alpha', String(merged.loraAlpha),
      '--lora-dropout', String(merged.loraDropout),
      '--warmup-steps', String(merged.warmupSteps),
      '--num-gpus', String(merged.numGPUs),
      '--hf-model', (merged as any).modelHfId || this.resolveModelRepo(merged.modelId),
    ]
    if (merged.useUnsloth) args.push('--use-unsloth')
    if (isAMD) args.push('--rocm')
    return args
  }

  private determineMultiGpuConfig(
    merged: FinetuneOptions,
    isAMD: boolean,
    onEvent: (event: TrainingEvent) => void
  ): { mode: string; flags: string[] } {
    const numGPUs = merged.numGPUs
    const useDDP = merged.multiGPUMode === 'ddp' ||
      (numGPUs > 1 && numGPUs < DDP_MAX_GPUS && merged.multiGPUMode !== 'fsdp' && merged.multiGPUMode !== 'deepspeed')
    const useFSDP = merged.multiGPUMode === 'fsdp' ||
      (numGPUs >= DDP_MAX_GPUS && merged.multiGPUMode !== 'deepspeed')
    const useDeepSpeed = merged.multiGPUMode === 'deepspeed' && !isAMD

    if (isAMD && merged.multiGPUMode === 'deepspeed') {
      onEvent({ type: 'log', message: 'DeepSpeed is CUDA-only. Falling back to DDP for AMD ROCm.' })
    }

    const flags: string[] = []
    if (useDDP || useFSDP || useDeepSpeed) flags.push('--ddp')
    if (useFSDP) flags.push('--fsdp')
    if (useDeepSpeed) flags.push('--deepspeed')

    const mode = useFSDP ? 'FSDP' : useDeepSpeed ? 'DeepSpeed' : 'DDP'
    return { mode, flags }
  }

  private buildCommandArgs(
    scriptPath: string,
    scriptArgs: string[],
    gpuFlags: string[],
    merged: FinetuneOptions,
    isMultiGPU: boolean
  ): { command: string; commandArgs: string[] } {
    const args = [...scriptArgs, ...gpuFlags]
    if (!isMultiGPU) {
      return { command: this.pythonCmd, commandArgs: [scriptPath, ...args] }
    }
    return {
      command: 'torchrun',
      commandArgs: [
        '--nproc_per_node', String(merged.numGPUs),
        '--nnodes', String(merged.nnodes || 1),
        '--node_rank', String(merged.nodeRank || 0),
        '--master_addr', merged.masterAddr || '127.0.0.1',
        '--master_port', TORCHRUN_MASTER_PORT,
        scriptPath,
        ...args,
      ],
    }
  }

  private spawnAndMonitor(
    command: string,
    commandArgs: string[],
    merged: FinetuneOptions,
    options: FinetuneOptions,
    onEvent: (event: TrainingEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const hfToken = secureStore.getHuggingFaceToken();
      const spawnEnv: NodeJS.ProcessEnv = { ...process.env, PYTHONUNBUFFERED: '1' };
      if (hfToken) {
        spawnEnv.HF_TOKEN = hfToken;
      }

      const lastOutputLines: string[] = [];
      const collectOutput = (text: string) => {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          lastOutputLines.push(line);
          if (lastOutputLines.length > 50) {
            lastOutputLines.shift();
          }
        }
      };

      const proc = spawn(command, commandArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv,
      })
      this.process = proc

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        collectOutput(text)
        this.parsePythonOutput(text, onEvent)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        collectOutput(text)
        if (text.includes('Error') || text.includes('Traceback')) {
          onEvent({ type: 'error', message: text })
        } else {
          this.parsePythonOutput(text, onEvent)
        }
      })

      proc.on('close', (code) => {
        this.process = null
        if (this.wasStoppedIntentionally) {
          this.wasStoppedIntentionally = false
          onEvent({ type: 'log', message: 'Training stopped by user.' })
          resolve()
          return
        }
        if (code === 0) {
          const outputDir = merged.outputDir || this.defaultOutputDir(options)
          onEvent({ type: 'done', adapterPath: path.join(outputDir, 'adapter'), modelPath: outputDir })
          resolve()
        } else {
          let errorDetails = `Python trainer exited with code ${code}`;
          const errorLine = [...lastOutputLines].reverse().find(
            line => line.includes('Error:') || line.includes('Exception:') || line.startsWith('Training failed:') || line.includes('Traceback')
          );
          if (errorLine) {
            errorDetails = errorLine;
          } else if (lastOutputLines.length > 0) {
            const lastLine = lastOutputLines[lastOutputLines.length - 1];
            if (lastLine && !lastLine.startsWith('LOSS:')) {
              errorDetails = `${lastLine} (exit code ${code})`;
            }
          }

          onEvent({ type: 'error', message: errorDetails })
          reject(new Error(errorDetails))
        }
      })

      proc.on('error', (err) => {
        this.process = null
        onEvent({ type: 'error', message: err.message })
        reject(err)
      })
    })
  }

  async startTraining(
    options: FinetuneOptions,
    onEvent: (event: TrainingEvent) => void
  ): Promise<void> {
    const scriptPath = path.join(this.scriptDir, 'finetune_qlora.py')
    const merged = { ...DEFAULT_FINETUNE_OPTIONS, ...options }
    const isAMD = merged.isAMD

    const scriptArgs = this.buildScriptArgs(options, merged, isAMD)
    const { flags: gpuFlags } = this.determineMultiGpuConfig(merged, isAMD, onEvent)

    const isMultiGPU = merged.numGPUs > 1
    if (isMultiGPU) {
      onEvent({
        type: 'log',
        message: `Starting multi-GPU training: ${merged.numGPUs} GPU(s), mode=${gpuFlags.includes('--fsdp') ? 'FSDP' : gpuFlags.includes('--deepspeed') ? 'DeepSpeed' : 'DDP'}`,
      })
    }

    const { command, commandArgs } = this.buildCommandArgs(scriptPath, scriptArgs, gpuFlags, merged, isMultiGPU)
    onEvent({ type: 'log', message: `Starting Python trainer: ${command} ${commandArgs.join(' ')}` })

    return this.spawnAndMonitor(command, commandArgs, merged, options, onEvent)
  }

  private parsePythonOutput(text: string, onEvent: (event: TrainingEvent) => void): void {
    const lines = text.split('\n').filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('LOSS:')) {
        const parts = line.split('|')
        const data: Record<string, number> = {}
        for (const part of parts) {
          const [key, val] = part.split(':')
          if (key && val) data[key.trim()] = parseFloat(val.trim())
        }
        onEvent({
          type: 'progress',
          data: {
            epoch: data['EPOCH'] || 0,
            totalEpochs: data['TOTAL_EPOCHS'] || 3,
            step: data['STEP'] || 0,
            totalSteps: data['TOTAL_STEPS'] || 1,
            loss: data['LOSS'] || 0,
            learningRate: data['LR'] || 0,
            gradNorm: data['GRAD_NORM'] || 0,
            tokensPerSecond: data['TOKENS/S'] || 0,
            elapsedSeconds: data['ELAPSED'] || 0,
            estimatedTotalSeconds: data['ESTIMATED'] || 0,
          },
        })
      } else {
        onEvent({ type: 'log', message: line })
      }
    }
  }

  async stopTraining(): Promise<void> {
    const proc = this.process
    if (!proc) return

    this.wasStoppedIntentionally = true

    try {
      if (process.platform === 'win32' && proc.pid) {
        // On Windows, SIGTERM is unreliable. Use taskkill to force kill the process tree.
        try {
          execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'pipe', timeout: STOP_TIMEOUT_MS })
        } catch {
          // If taskkill fails, try direct kill
          try { proc.kill('SIGKILL') } catch {}
        }
      } else {
        proc.kill('SIGTERM')
        // Fallback: SIGKILL after 5 seconds if process is still alive
        await new Promise<void>((resolve) => {
          const killTimer = setTimeout(() => {
            try { proc.kill('SIGKILL') } catch {}
            resolve()
          }, 5000)
          proc.once('exit', () => {
            clearTimeout(killTimer)
            resolve()
          })
        })
      }
    } catch {
      // Process may already be dead
    }

    this.process = null
  }

  getModelPath(options: FinetuneOptions): string {
    return options.outputDir || this.defaultOutputDir(options)
  }

  private defaultOutputDir(options: FinetuneOptions): string {
    try {
      const { app } = require('electron')
      if (app.isPackaged) {
        return path.join(app.getPath('documents'), 'SmartCursorX', 'finetuned', options.modelId)
      }
    } catch {}
    return path.join(process.cwd(), 'finetuned', options.modelId)
  }

  private resolveModelRepo(modelId: string): string {
    const hfRepos: Record<string, string> = {
      'qwen2.5-coder-7b': 'Qwen/Qwen2.5-Coder-7B-Instruct',
      'deepseek-coder-6.7b': 'deepseek-ai/deepseek-coder-6.7b-instruct',
      'codellama-7b': 'codellama/CodeLlama-7b-Instruct-hf',
      'phi-3.5-mini': 'microsoft/Phi-3.5-mini-instruct',
      'granite-3b-code': 'ibm-granite/granite-3b-code-instruct',
    }
    return hfRepos[modelId] || modelId
  }
}
