import * as fs from 'fs'
import * as path from 'path'
import { PathGuard } from './PathGuard'
import {
  DatasetConfig,
  DatasetTaskType,
  ALLOWED_EXTENSIONS,
  DEFAULT_DATASET_CONFIG,
} from '../constants/models'

export interface DatasetSample {
  instruction: string
  input: string
  output: string
  sourceFile: string
  taskType: DatasetTaskType
}

export interface DatasetManifest {
  samples: number
  taskTypes: Record<string, number>
  sourceFiles: number
  totalTokens: number
  createdAt: string
  config: DatasetConfig
}

export class DatasetService {
  private samples: DatasetSample[] = []

  async scanWorkspace(
    workspacePath: string,
    config: DatasetConfig = DEFAULT_DATASET_CONFIG,
    onProgress?: (file: string, total: number) => void
  ): Promise<DatasetManifest> {
    this.samples = []
    const codeFiles: string[] = []

    const walkDir = (dir: string) => {
      if (!PathGuard.isContained(dir)) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
            walkDir(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (ALLOWED_EXTENSIONS.has(ext)) {
              codeFiles.push(fullPath)
            }
          }
        }
      } catch {
        // permission denied, skip
      }
    }

    walkDir(workspacePath)

    for (let i = 0; i < codeFiles.length; i++) {
      const filePath = codeFiles[i]
      if (this.samples.length >= config.maxSamples) break
      onProgress?.(filePath, codeFiles.length)

      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        if (content.length < config.minCodeLength) continue

        const relativePath = path.relative(workspacePath, filePath)
        const chunks = this.chunkCode(content, config.maxInputLength)

        for (const chunk of chunks) {
          for (const taskType of config.taskTypes) {
            if (this.samples.length >= config.maxSamples) break
            const sample = this.createSample(relativePath, chunk, taskType)
            if (sample) this.samples.push(sample)
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    return this.buildManifest(config)
  }

  private chunkCode(content: string, maxLength: number): string[] {
    const lines = content.split('\n')
    const chunks: string[] = []
    let current: string[] = []
    let currentLen = 0

    for (const line of lines) {
      if (currentLen + line.length > maxLength && current.length > 0) {
        chunks.push(current.join('\n'))
        current = []
        currentLen = 0
      }
      current.push(line)
      currentLen += line.length
    }
    if (current.length > 0) chunks.push(current.join('\n'))
    return chunks
  }

  private createSample(
    relativePath: string,
    code: string,
    taskType: DatasetTaskType
  ): DatasetSample | null {
    switch (taskType) {
      case 'explain':
        return {
          instruction: `Explain what this ${relativePath} code does and describe its purpose, inputs, and outputs.`,
          input: code,
          output: `[This code is from ${relativePath}]`,
          sourceFile: relativePath,
          taskType,
        }
      case 'complete':
        return this.createCompletionSample(relativePath, code)
      case 'refactor':
        return {
          instruction: `Suggest specific refactoring improvements for the following code from ${relativePath}. Focus on readability, performance, and maintainability.`,
          input: code,
          output: `[Refactoring suggestions for ${relativePath}]`,
          sourceFile: relativePath,
          taskType,
        }
      case 'docstring':
        return this.createDocstringSample(relativePath, code)
      case 'bug_detection':
        return {
          instruction: `Review the following code from ${relativePath} for potential bugs, edge cases, and logic errors.`,
          input: code,
          output: `[Code review for ${relativePath}]`,
          sourceFile: relativePath,
          taskType,
        }
      default:
        return null
    }
  }

  private createCompletionSample(relativePath: string, code: string): DatasetSample | null {
    const lines = code.split('\n')
    if (lines.length < 5) return null
    const splitPoint = Math.floor(lines.length * 0.7)
    const prefix = lines.slice(0, splitPoint).join('\n')
    const suffix = lines.slice(splitPoint).join('\n')
    return {
      instruction: `Complete the following code from ${relativePath}. Return only the missing implementation.`,
      input: prefix,
      output: suffix,
      sourceFile: relativePath,
      taskType: 'complete' as DatasetTaskType,
    }
  }

  private createDocstringSample(relativePath: string, code: string): DatasetSample | null {
    const funcMatch = code.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/)
    if (!funcMatch) return null
    return {
      instruction: `Generate a comprehensive JSDoc/docstring for the function \`${funcMatch[1]}\` in ${relativePath}.`,
      input: code,
      output: `[Documentation for ${funcMatch[1]}]`,
      sourceFile: relativePath,
      taskType: 'docstring' as DatasetTaskType,
    }
  }

  exportDataset(outputPath: string): string {
    const jsonl = this.samples
      .map((s) =>
        JSON.stringify({
          instruction: s.instruction,
          input: s.input,
          output: s.output,
        })
      )
      .join('\n')
    fs.writeFileSync(outputPath, jsonl, 'utf-8')
    return outputPath
  }

  getSamples(): DatasetSample[] {
    return this.samples
  }

  private buildManifest(config: DatasetConfig): DatasetManifest {
    const taskTypes: Record<string, number> = {}
    for (const s of this.samples) {
      taskTypes[s.taskType] = (taskTypes[s.taskType] || 0) + 1
    }
    const sourceFiles = new Set(this.samples.map((s) => s.sourceFile))
    const totalTokens = this.samples.reduce(
      (sum, s) => sum + s.instruction.length + s.input.length + s.output.length,
      0
    )
    return {
      samples: this.samples.length,
      taskTypes,
      sourceFiles: sourceFiles.size,
      totalTokens,
      createdAt: new Date().toISOString(),
      config,
    }
  }
}

export const datasetService = new DatasetService()
