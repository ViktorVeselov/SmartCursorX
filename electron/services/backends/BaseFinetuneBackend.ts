export interface HardwareSpec {
  gpuAvailable: boolean
  gpuName: string
  vramGB: number
  cudaCores: number
  cpuCores: number
  ramGB: number
  backendType: BackendCapability
  numGPUs: number
  isAMD: boolean
  rocmVersion?: string
}

export type BackendCapability = 'llamacpp' | 'python_cuda' | 'python_rocm' | 'python_mps' | 'python_cpu' | 'none'

export const BYTES_PER_GB = 1024 ** 3
export const CACHE_TTL_DAYS = 30
export const DDP_MAX_GPUS = 8
export const TORCHRUN_MASTER_PORT = '29500'
export const STOP_TIMEOUT_MS = 5000
export const DETECT_TIMEOUT_MS = 5000
export const PYTHON_IMPORT_TIMEOUT_MS = 30000

export const QUANT_FORMAT_MAP: Record<string, string> = {
  '4bit': 'q4_0',
  '8bit': 'q8_0',
}

export const TIER_SCORES: Record<string, number> = {
  verified: 3,
  community: 2,
  experimental: 1,
}

export function commandExists(cmd: string, timeoutMs = DETECT_TIMEOUT_MS): boolean {
  try {
    const { execSync } = require('child_process')
    execSync(`${cmd} --version`, { stdio: 'pipe', timeout: timeoutMs })
    return true
  } catch {
    try {
      const { execSync } = require('child_process')
      execSync(`${cmd} --help`, { stdio: 'pipe', timeout: timeoutMs })
      return true
    } catch {
      return false
    }
  }
}

export function runCommand(cmd: string, timeoutMs = DETECT_TIMEOUT_MS): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    exec(cmd, { timeout: timeoutMs, encoding: 'utf-8' }, (err: any, stdout: string, stderr: string) => {
      if (err) {
        resolve({ ok: false, stdout: '', stderr: err.message || 'Command failed' })
      } else {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr || '' })
      }
    })
  })
}

export interface TrainingProgress {
  epoch: number
  totalEpochs: number
  step: number
  totalSteps: number
  loss: number
  learningRate: number
  gradNorm: number
  tokensPerSecond: number
  elapsedSeconds: number
  estimatedTotalSeconds: number
}

export type TrainingEvent =
  | { type: 'progress'; data: TrainingProgress }
  | { type: 'log'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; adapterPath: string; modelPath: string }
  | { type: 'hardware'; spec: HardwareSpec }

export interface FinetuneOptions {
  modelId: string
  quantization: '4bit' | '8bit' | '16bit'
  backend: 'auto' | 'llamacpp' | 'python'
  datasetPath: string
  outputDir: string
  learningRate: number
  numEpochs: number
  batchSize: number
  maxSeqLength: number
  loraRank: number
  loraAlpha: number
  loraDropout: number
  warmupSteps: number
  useUnsloth: boolean
  numGPUs: number
  multiGPUMode: 'auto' | 'ddp' | 'fsdp' | 'deepspeed'
  nnodes: number
  nodeRank: number
  masterAddr: string
  isAMD: boolean
}

export const DEFAULT_FINETUNE_OPTIONS: FinetuneOptions = {
  modelId: 'qwen2.5-coder-7b',
  quantization: '4bit',
  backend: 'auto',
  datasetPath: '',
  outputDir: '',
  learningRate: 2e-4,
  numEpochs: 3,
  batchSize: 4,
  maxSeqLength: 2048,
  loraRank: 16,
  loraAlpha: 32,
  loraDropout: 0.05,
  warmupSteps: 50,
  useUnsloth: true,
  numGPUs: 1,
  multiGPUMode: 'auto',
  nnodes: 1,
  nodeRank: 0,
  masterAddr: '127.0.0.1',
  isAMD: false,
}

export interface BackendAvailability {
  available: boolean
  error?: string
  missing?: string[]
  details?: string
}

export interface FinetuneBackend {
  readonly name: string
  readonly capabilities: BackendCapability[]

  detectHardware(): Promise<HardwareSpec>
  isAvailable(): Promise<BackendAvailability>
  prepareEnvironment(options: FinetuneOptions): Promise<void>
  startTraining(options: FinetuneOptions, onEvent: (event: TrainingEvent) => void): Promise<void>
  stopTraining(): Promise<void>
  getModelPath(options: FinetuneOptions): string
}

export async function detectGpuHardware(cpuCores: number, ramGB: number): Promise<HardwareSpec> {
  const spec: HardwareSpec = {
    gpuAvailable: false,
    gpuName: 'CPU',
    vramGB: 0,
    cudaCores: 0,
    cpuCores,
    ramGB,
    backendType: 'python_cpu',
    numGPUs: 0,
    isAMD: false,
  }

  // 1. Try NVIDIA-SMI first (Windows and Linux)
  try {
    const nSmi = await runCommand('nvidia-smi --query-gpu=name,memory.total,count --format=csv,noheader')
    if (nSmi.ok && nSmi.stdout) {
      const lines = nSmi.stdout.split('\n').filter(Boolean)
      const first = lines[0]?.split(', ')
      if (first && first.length >= 2) {
        spec.gpuAvailable = true
        spec.gpuName = first[0]
        spec.numGPUs = lines.length
        const vramMatch = first[1].match(/(\d+)/)
        if (vramMatch) {
          spec.vramGB = Math.round(parseInt(vramMatch[1]) / 1024)
        }
        spec.backendType = 'python_cuda'
        spec.isAMD = false
        return spec
      }
    }
  } catch (e) {
    // Ignore and proceed
  }

  // 2. Windows specific WMI / CimInstance detection
  if (process.platform === 'win32') {
    try {
      // Try Get-CimInstance first, fallback to Get-WmiObject
      let result = await runCommand(
        'powershell -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json"'
      )
      if (!result.ok) {
        result = await runCommand(
          'powershell -Command "Get-WmiObject Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json"'
        )
      }

      if (result.ok && result.stdout) {
        const parsed = JSON.parse(result.stdout)
        const entries = Array.isArray(parsed) ? parsed : [parsed]
        // Filter out basic display adapters
        const dedicated = entries.find((e: any) => {
          if (!e || !e.Name) return false
          const name = e.Name.toLowerCase()
          if (name.includes('microsoft basic') || name.includes('citrix') || name.includes('virtual')) return false
          const ram = parseInt(e.AdapterRAM)
          return (ram && Math.abs(ram) > 100 * 1024 * 1024) || /nvidia|amd|radeon|geforce/i.test(e.Name)
        })

        if (dedicated) {
          spec.gpuAvailable = true
          spec.gpuName = dedicated.Name
          spec.numGPUs = entries.filter((e: any) => e && e.AdapterRAM && Math.abs(parseInt(e.AdapterRAM)) > 100 * 1024 * 1024).length || 1
          
          let ramBytes = parseInt(dedicated.AdapterRAM)
          if (ramBytes < 0) {
            // Unsigned 32-bit overflow correction
            ramBytes += 4294967296
          }
          spec.vramGB = Math.round(ramBytes / (1024 * 1024 * 1024)) || 4 // Default to 4GB fallback
          
          spec.isAMD = /amd|radeon|ellesmere|navi|vega/i.test(dedicated.Name)
          spec.backendType = spec.isAMD ? 'python_rocm' : 'python_cuda'
          return spec
        }
      }
    } catch (e) {
      // Ignore and proceed
    }
  }

  // 3. macOS specific detection (Intel AMD GPUs and Apple Silicon)
  if (process.platform === 'darwin') {
    try {
      const sysctlM1 = await runCommand('sysctl -n hw.optional.arm64')
      const isArm64 = sysctlM1.ok && sysctlM1.stdout.trim() === '1'
      
      if (isArm64) {
        spec.gpuAvailable = true
        spec.gpuName = 'Apple Silicon (Unified Memory)'
        spec.vramGB = ramGB
        spec.backendType = 'python_mps'
        spec.numGPUs = 1
        spec.isAMD = false
        return spec
      }

      // Intel Macs with AMD GPUs
      const displays = await runCommand('system_profiler SPDisplaysDataType')
      if (displays.ok && displays.stdout) {
        const lines = displays.stdout.split('\n')
        let currentGpuName = ''
        let currentVram = 0
        for (const line of lines) {
          if (line.includes('Chipset Model:')) {
            currentGpuName = line.split('Chipset Model:')[1].trim()
          }
          if (line.includes('VRAM (Total):') || line.includes('VRAM (Dynamic, Max):') || line.includes('VRAM:')) {
            const vramStr = line.split(':')[1]
            const match = vramStr.match(/(\d+)\s*(GB|MB)/i)
            if (match) {
              const val = parseInt(match[1])
              const unit = match[2].toUpperCase()
              currentVram = unit === 'GB' ? val : Math.round(val / 1024)
            }
          }
          if (currentGpuName && /amd|radeon/i.test(currentGpuName) && currentVram > 0) {
            spec.gpuAvailable = true
            spec.gpuName = currentGpuName
            spec.vramGB = currentVram
            spec.isAMD = true
            spec.backendType = 'python_rocm'
            spec.numGPUs = 1
            return spec
          }
        }
      }
    } catch (e) {
      // Ignore and proceed
    }
  }

  // 4. Linux specific detection (lspci fallback)
  if (process.platform === 'linux') {
    try {
      const lspci = await runCommand('lspci -v')
      if (lspci.ok && lspci.stdout) {
        const lines = lspci.stdout.split('\n')
        let currentController = ''
        for (const line of lines) {
          if (line.includes('VGA compatible controller') || line.includes('3D controller')) {
            currentController = line
          }
          if (currentController && /amd|radeon/i.test(currentController)) {
            spec.gpuAvailable = true
            spec.gpuName = currentController.split(': ')[1] || 'AMD Radeon GPU'
            spec.isAMD = true
            spec.backendType = 'python_rocm'
            spec.numGPUs = 1
            try {
              const vramSize = await runCommand('cat /sys/class/drm/card0/device/mem_info_vram_total')
              if (vramSize.ok && vramSize.stdout) {
                spec.vramGB = Math.round(parseInt(vramSize.stdout) / (1024 * 1024 * 1024))
              }
            } catch {}
            if (!spec.vramGB) spec.vramGB = 4
            return spec
          }
        }
      }
    } catch (e) {
      // Ignore and proceed
    }
  }

  return spec
}

