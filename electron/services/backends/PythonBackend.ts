import { spawn, ChildProcess, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  FinetuneBackend,
  BackendCapability,
  HardwareSpec,
  FinetuneOptions,
  TrainingEvent,
  DEFAULT_FINETUNE_OPTIONS,
} from './BaseFinetuneBackend'

export class PythonBackend implements FinetuneBackend {
  readonly name = 'Python (PyTorch)'
  readonly capabilities: BackendCapability[] = ['python_cuda', 'python_mps', 'python_cpu']
  private process: ChildProcess | null = null

  private get pythonCmd(): string {
    return process.platform === 'win32' ? 'python' : 'python3'
  }

  private get scriptDir(): string {
    return path.join(process.cwd(), 'scripts')
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync(`${this.pythonCmd} -c "import torch; import transformers; import peft; import bitsandbytes" 2>&1`, {
        stdio: 'pipe',
        timeout: 15000,
      })
      return true
    } catch {
      try {
        execSync(`${this.pythonCmd} -c "import torch; import transformers; import peft" 2>&1`, {
          stdio: 'pipe',
          timeout: 15000,
        })
        return true
      } catch {
        return false
      }
    }
  }

  async detectHardware(): Promise<HardwareSpec> {
    const spec: HardwareSpec = {
      gpuAvailable: false,
      gpuName: 'CPU',
      vramGB: 0,
      cudaCores: 0,
      cpuCores: require('os').cpus().length,
      ramGB: Math.round(require('os').totalmem() / (1024 ** 3)),
      backendType: 'python_cpu',
      numGPUs: 0,
      isAMD: false,
    }

    try {
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
" 2>&1`
      const out = execSync(detectScript, { timeout: 15000, encoding: 'utf-8' })
      const parts = out.trim().split('|')
      if (parts[0] && parts[0] !== '') {
        spec.gpuAvailable = true
        spec.gpuName = parts[0]
        spec.vramGB = parseInt(parts[1]) || 0
        spec.numGPUs = parseInt(parts[2]) || 1
        spec.isAMD = parts[3] === '1'
        spec.rocmVersion = parts[4] || undefined
        spec.backendType = spec.isAMD ? 'python_rocm' : 'python_cuda'
      }
    } catch {
      try {
        const out = execSync(
          `${this.pythonCmd} -c "import torch; v='MPS' if torch.backends.mps.is_available() else ''; print(v)" 2>&1`,
          { timeout: 10000, encoding: 'utf-8' }
        )
        if (out.trim() === 'MPS') {
          spec.gpuAvailable = true
          spec.gpuName = 'Apple Silicon (MPS)'
          spec.vramGB = spec.ramGB
          spec.numGPUs = 1
          spec.isAMD = false
          spec.backendType = 'python_mps'
        }
      } catch {}
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

  async startTraining(
    options: FinetuneOptions,
    onEvent: (event: TrainingEvent) => void
  ): Promise<void> {
    const scriptPath = path.join(this.scriptDir, 'finetune_qlora.py')

    const merged = { ...DEFAULT_FINETUNE_OPTIONS, ...options }
    const scriptArgs = [
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

    const isAMD = merged.isAMD

    if (merged.useUnsloth) scriptArgs.push('--use-unsloth')
    if (isAMD) scriptArgs.push('--rocm')

    // Determine multi-GPU mode
    const numGPUs = merged.numGPUs
    const useDDP = merged.multiGPUMode === 'ddp' || (numGPUs > 1 && numGPUs < 8 && merged.multiGPUMode !== 'fsdp' && merged.multiGPUMode !== 'deepspeed')
    const useFSDP = merged.multiGPUMode === 'fsdp' || (numGPUs >= 8 && merged.multiGPUMode !== 'deepspeed')
    const useDeepSpeed = merged.multiGPUMode === 'deepspeed' && !isAMD

    if (isAMD && merged.multiGPUMode === 'deepspeed') {
      onEvent({ type: 'log', message: 'DeepSpeed is CUDA-only. Falling back to DDP for AMD ROCm.' })
    }

    if (useDDP || useFSDP || useDeepSpeed) {
      scriptArgs.push('--ddp')
    }
    if (useFSDP) {
      scriptArgs.push('--fsdp')
    }
    if (useDeepSpeed) {
      scriptArgs.push('--deepspeed')
    }

    const isMultiGPU = numGPUs > 1

    if (isMultiGPU) {
      onEvent({
        type: 'log',
        message: `Starting multi-GPU training: ${numGPUs} GPU(s), mode=${useFSDP ? 'FSDP' : useDeepSpeed ? 'DeepSpeed' : 'DDP'}`,
      })
    }

    const command = isMultiGPU ? 'torchrun' : this.pythonCmd
    const commandArgs: string[] = isMultiGPU
      ? [
          '--nproc_per_node', String(numGPUs),
          '--nnodes', String(merged.nnodes || 1),
          '--node_rank', String(merged.nodeRank || 0),
          '--master_addr', merged.masterAddr || '127.0.0.1',
          '--master_port', '29500',
          scriptPath,
          ...scriptArgs,
        ]
      : [scriptPath, ...scriptArgs]

    onEvent({ type: 'log', message: `Starting Python trainer: ${command} ${commandArgs.join(' ')}` })

    return new Promise((resolve, reject) => {
      this.process = spawn(command, commandArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.parsePythonOutput(text, onEvent)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        if (text.includes('Error') || text.includes('Traceback')) {
          onEvent({ type: 'error', message: text })
        } else {
          this.parsePythonOutput(text, onEvent)
        }
      })

      this.process.on('close', (code) => {
        this.process = null
        if (code === 0) {
          const outputDir = merged.outputDir || this.defaultOutputDir(options)
          onEvent({ type: 'done', adapterPath: path.join(outputDir, 'adapter'), modelPath: outputDir })
          resolve()
        } else {
          onEvent({ type: 'error', message: `Python trainer exited with code ${code}` })
          reject(new Error(`Training failed: exit code ${code}`))
        }
      })

      this.process.on('error', (err) => {
        this.process = null
        onEvent({ type: 'error', message: err.message })
        reject(err)
      })
    })
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
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process) this.process.kill('SIGKILL')
      }, 5000)
      this.process = null
    }
  }

  getModelPath(options: FinetuneOptions): string {
    return options.outputDir || this.defaultOutputDir(options)
  }

  private defaultOutputDir(options: FinetuneOptions): string {
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
