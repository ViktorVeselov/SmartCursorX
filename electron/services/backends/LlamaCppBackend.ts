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
} from './BaseFinetuneBackend'

export class LlamaCppBackend implements FinetuneBackend {
  readonly name = 'llama.cpp'
  readonly capabilities: BackendCapability[] = ['llamacpp']
  private process: ChildProcess | null = null

  private get finetuneBin(): string {
    return process.platform === 'win32' ? 'llama-finetune.exe' : 'llama-finetune'
  }

  private get quantizeBin(): string {
    return process.platform === 'win32' ? 'llama-quantize.exe' : 'llama-quantize'
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync(`${this.finetuneBin} --help 2>&1 || ${this.quantizeBin} --help 2>&1`, {
        stdio: 'pipe',
        timeout: 5000,
      })
      return true
    } catch {
      return false
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
      backendType: 'llamacpp',
      numGPUs: 1,
      isAMD: false,
    }

    try {
      const out = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1', {
        timeout: 5000,
        encoding: 'utf-8',
      })
      const parts = out.trim().split(', ')
      if (parts.length >= 2) {
        spec.gpuAvailable = true
        spec.gpuName = parts[0]
        const vramMatch = parts[1].match(/(\d+)/)
        if (vramMatch) spec.vramGB = parseInt(vramMatch[1]) / 1024
        spec.backendType = 'llamacpp'
      }
    } catch {
      // no NVIDIA GPU detected
    }

    if (process.platform === 'darwin') {
      try {
        const mem = execSync('sysctl -n hw.memsize', { encoding: 'utf-8' }).trim()
        spec.ramGB = Math.round(parseInt(mem) / (1024 ** 3))
        if (spec.ramGB >= 8) {
          spec.gpuAvailable = true
          spec.gpuName = 'Apple Silicon (Unified Memory)'
          spec.vramGB = spec.ramGB
          spec.backendType = 'llamacpp'
        }
      } catch {}
    }

    return spec
  }

  async prepareEnvironment(options: FinetuneOptions): Promise<void> {
    const outputDir = options.outputDir || this.defaultOutputDir(options)
    fs.mkdirSync(outputDir, { recursive: true })
  }

  async startTraining(
    options: FinetuneOptions,
    onEvent: (event: TrainingEvent) => void
  ): Promise<void> {
    const outputPath = path.join(
      options.outputDir || this.defaultOutputDir(options),
      'finetuned.gguf'
    )

    const merged = { ...DEFAULT_FINETUNE_OPTIONS, ...options }
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

    if (merged.quantization === '4bit') args.push('--quantize', 'q4_0')
    else if (merged.quantization === '8bit') args.push('--quantize', 'q8_0')

    onEvent({ type: 'log', message: `Starting llama-finetune: ${this.finetuneBin} ${args.join(' ')}` })

    return new Promise((resolve, reject) => {
      this.process = spawn(this.finetuneBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      let stdout = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        this.parseLlamacppOutput(text, onEvent)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        this.parseLlamacppOutput(text, onEvent)
      })

      this.process.on('close', (code) => {
        this.process = null
        if (code === 0) {
          onEvent({
            type: 'done',
            adapterPath: outputPath,
            modelPath: outputPath,
          })
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
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }

  getModelPath(options: FinetuneOptions): string {
    return path.join(
      options.outputDir || this.defaultOutputDir(options),
      'finetuned.gguf'
    )
  }

  private defaultOutputDir(options: FinetuneOptions): string {
    return path.join(process.cwd(), 'finetuned', options.modelId)
  }
}
