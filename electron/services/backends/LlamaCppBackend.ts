import { execSync, spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import {
  FinetuneBackend,
  BackendCapability,
  HardwareSpec,
  FinetuneOptions,
  TrainingEvent,
  DEFAULT_FINETUNE_OPTIONS,
  BackendAvailability,
  QUANT_FORMAT_MAP,
  BYTES_PER_GB,
  STOP_TIMEOUT_MS,
  commandExists,
  runCommand,
} from './BaseFinetuneBackend'

export class LlamaCppBackend implements FinetuneBackend {
  readonly name = 'llama.cpp'
  readonly capabilities: BackendCapability[] = ['llamacpp']
  private process: ChildProcess | null = null
  private wasStoppedIntentionally = false

  private get finetuneBin(): string {
    return process.platform === 'win32' ? 'llama-finetune.exe' : 'llama-finetune'
  }

  private get quantizeBin(): string {
    return process.platform === 'win32' ? 'llama-quantize.exe' : 'llama-quantize'
  }

  async isAvailable(): Promise<BackendAvailability> {
    if (commandExists(this.finetuneBin)) {
      return { available: true }
    }

    if (commandExists(this.quantizeBin)) {
      return { available: true }
    }

    const binName = process.platform === 'win32' ? 'llama-finetune.exe' : 'llama-finetune'
    return {
      available: false,
      error: `llama.cpp not found. Install from https://github.com/ggml-org/llama.cpp/releases and add ${binName} to PATH.`,
      missing: ['llama-finetune'],
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
      backendType: 'llamacpp',
      numGPUs: 1,
      isAMD: false,
    }

    const nvidiaResult = await runCommand('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader')
    if (nvidiaResult.ok) {
      const parts = nvidiaResult.stdout.split(', ')
      if (parts.length >= 2) {
        spec.gpuAvailable = true
        spec.gpuName = parts[0]
        const vramMatch = parts[1].match(/(\d+)/)
        if (vramMatch) spec.vramGB = parseInt(vramMatch[1]) / 1024
        spec.backendType = 'llamacpp'
      }
    }

    if (process.platform === 'darwin') {
      const memResult = await runCommand('sysctl -n hw.memsize')
      if (memResult.ok) {
        spec.ramGB = Math.round(parseInt(memResult.stdout) / BYTES_PER_GB)
        if (spec.ramGB >= 8) {
          spec.gpuAvailable = true
          spec.gpuName = 'Apple Silicon (Unified Memory)'
          spec.vramGB = spec.ramGB
          spec.backendType = 'llamacpp'
        }
      }
    }

    return spec
  }

  async prepareEnvironment(options: FinetuneOptions): Promise<void> {
    const outputDir = options.outputDir || this.defaultOutputDir(options)
    fs.mkdirSync(outputDir, { recursive: true })
  }

  private buildArgs(
    merged: FinetuneOptions,
    outputPath: string
  ): string[] {
    const args = [
      '--model', merged.modelId,
      '--dataset', merged.datasetPath,
      '--output', outputPath,
      '--lora-rank', String(merged.loraRank),
      '--lora-alpha', String(merged.loraAlpha),
      '--learning-rate', String(merged.learningRate),
      '--epochs', String(merged.numEpochs),
      '--batch-size', String(merged.batchSize),
      '--threads', String(require('os').cpus().length),
    ]
    if (merged.quantization === '4bit') args.push('--quantize', QUANT_FORMAT_MAP['4bit'])
    else if (merged.quantization === '8bit') args.push('--quantize', QUANT_FORMAT_MAP['8bit'])
    return args
  }

  private spawnAndMonitor(
    args: string[],
    outputPath: string,
    onEvent: (event: TrainingEvent) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.finetuneBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.parseLlamacppOutput(data.toString(), onEvent)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.parseLlamacppOutput(data.toString(), onEvent)
      })

      this.process.on('close', (code) => {
        this.process = null
        if (this.wasStoppedIntentionally) {
          this.wasStoppedIntentionally = false
          onEvent({ type: 'log', message: 'Training stopped by user.' })
          resolve()
          return
        }
        if (code === 0) {
          onEvent({ type: 'done', adapterPath: outputPath, modelPath: outputPath })
          resolve()
        } else {
          onEvent({ type: 'error', message: `llama-finetune exited with code ${code}` })
          reject(new Error(`llama-finetune failed: exit code ${code}`))
        }
      })

      this.process.on('error', (err) => {
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
    const outputPath = path.join(options.outputDir || this.defaultOutputDir(options), 'finetuned.gguf')
    const merged = { ...DEFAULT_FINETUNE_OPTIONS, ...options }
    const args = this.buildArgs(merged, outputPath)

    onEvent({ type: 'log', message: `Starting llama-finetune: ${this.finetuneBin} ${args.join(' ')}` })
    return this.spawnAndMonitor(args, outputPath, onEvent)
  }

  private parseLlamacppOutput(text: string, onEvent: (event: TrainingEvent) => void): void {
    const lines = text.split('\n').filter(Boolean)
    for (const line of lines) {
      onEvent({ type: 'log', message: line })

      const progressMatch = line.match(
        /epoch\s+(\d+)\/(\d+)\s.*?step\s+(\d+)\/(\d+)\s.*?loss[=:]?\s*([\d.]+)/i
      )
      if (progressMatch) {
        onEvent({
          type: 'progress',
          data: {
            epoch: parseInt(progressMatch[1]),
            totalEpochs: parseInt(progressMatch[2]),
            step: parseInt(progressMatch[3]),
            totalSteps: parseInt(progressMatch[4]),
            loss: parseFloat(progressMatch[5]),
            learningRate: 0,
            gradNorm: 0,
            tokensPerSecond: 0,
            elapsedSeconds: 0,
            estimatedTotalSeconds: 0,
          },
        })
      }
    }
  }

  async stopTraining(): Promise<void> {
    const proc = this.process
    if (!proc) return
    this.wasStoppedIntentionally = true
    try {
      if (process.platform === 'win32' && proc.pid) {
        try {
          execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'pipe', timeout: STOP_TIMEOUT_MS })
        } catch {
          try { proc.kill('SIGKILL') } catch {}
        }
      } else {
        proc.kill('SIGTERM')
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
    return path.join(
      options.outputDir || this.defaultOutputDir(options),
      'finetuned.gguf'
    )
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
}
