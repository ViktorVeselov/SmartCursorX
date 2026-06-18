import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import { TOP_CODING_MODELS } from '../constants/models';

export interface LocalModelEntry {
  name: string;
  path: string;
  size: number;
}

export interface HuggingFaceModel {
  id: string;
  repo: string;
  description: string;
  downloads: number;
  ggufFiles: string[];
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export const DEFAULT_CONTEXT_SIZE = 2048;

const MODEL_MAX_CONTEXT_MAP: { pattern: string; contextWindow: number }[] = TOP_CODING_MODELS.map(m => {
  const repoName = m.hfRepo.split('/').slice(1).join('/').toLowerCase();
  return { pattern: repoName, contextWindow: m.contextWindow };
});

function resolveModelMaxContext(modelName: string): number {
  const name = modelName.toLowerCase().replace(/\.gguf$/, '').replace(/-q\d+_\d+$/, '');
  for (const entry of MODEL_MAX_CONTEXT_MAP) {
    if (name.includes(entry.pattern)) return entry.contextWindow;
  }
  const commonPatterns: [RegExp, number][] = [
    [/smollm2?\d*/i, 2048], [/llama\s*-?\s*3/i, 8192], [/llama\s*-?\s*2/i, 4096],
    [/mistral/i, 32768], [/mixtral/i, 32768], [/gemma/i, 8192],
    [/falcon/i, 2048], [/starcoder/i, 8192], [/dolphin/i, 8192],
    [/nous-?hermes/i, 8192], [/yi/i, 4096], [/phi/i, 4096],
  ];
  for (const [re, ctx] of commonPatterns) {
    if (re.test(name)) return ctx;
  }
  return 4096;
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

function clampContextByHardware(modelPath: string, requestedContext: number): number {
  try {
    const stat = fs.statSync(modelPath);
    const fileSizeGB = stat.size / BYTES_PER_GB;
    const secureStore = require('../secureStore').secureStore;
    const hw = secureStore.getHardwareSpec();
    const availableGB = hw?.vramGB || hw?.ramGB || 4;
    const kvRatio = 0.12;
    const modelMemoryGB = fileSizeGB * 1.15;
    const kvPerTokenGB = modelMemoryGB * kvRatio / DEFAULT_CONTEXT_SIZE;
    const overheadGB = 0.5;
    const maxSafeContext = Math.floor((availableGB - modelMemoryGB - overheadGB) / kvPerTokenGB);
    const clamped = Math.min(requestedContext, Math.max(512, maxSafeContext));
    const quantized = Math.floor(clamped / 256) * 256;
    return Math.max(512, quantized);
  } catch {
    return requestedContext;
  }
}

export class LocalModelService {
  private static instance: LocalModelService;
  private serverProcess: import('child_process').ChildProcess | null = null;
  private serverPort = 8080;
  private modelsDir: string;
  private runningModel: string | null = null;
  private serverContextSize: number = DEFAULT_CONTEXT_SIZE;

  private constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    app.on('will-quit', () => this.stopServer());
  }

  static getInstance(): LocalModelService {
    if (!LocalModelService.instance) {
      LocalModelService.instance = new LocalModelService();
    }
    return LocalModelService.instance;
  }

  listModels(): LocalModelEntry[] {
    try {
      const files = fs.readdirSync(this.modelsDir);
      return files
        .filter(f => f.endsWith('.gguf'))
        .map(f => {
          const fp = path.join(this.modelsDir, f);
          try {
            const stat = fs.statSync(fp);
            return { name: f, path: fp, size: stat.size };
          } catch { return null; }
        })
        .filter((e): e is LocalModelEntry => e !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch { return []; }
  }

  deleteModel(name: string): boolean {
    try {
      const fp = path.join(this.modelsDir, name);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
        return true;
      }
      return false;
    } catch { return false; }
  }

  getModelsDir(): string {
    return this.modelsDir;
  }

  async searchHuggingFace(query: string): Promise<HuggingFaceModel[]> {
    try {
      const seen = new Set<string>();
      const results: HuggingFaceModel[] = [];
      const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&tags=gguf&sort=downloads&direction=-1&limit=15`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`[LocalModelService] HF search error: ${resp.status} ${resp.statusText}`);
        return [];
      }
      const data = await resp.json() as any[];
      for (const item of data) {
        if (!item.id || seen.has(item.id)) continue;
        seen.add(item.id);
        results.push({
          id: item.id,
          repo: item.id,
          description: (item.description || item.tags?.join(', ') || '').substring(0, 200),
          downloads: item.downloads || 0,
          ggufFiles: [],
        });
      }
      return results;
    } catch (e) {
      console.error(`[LocalModelService] Search failed for "${query}":`, e);
      return [];
    }
  }

  async getModelFiles(repo: string): Promise<string[]> {
    try {
      const resp = await fetch(`https://huggingface.co/api/models/${repo}`);
      if (!resp.ok) {
        console.error(`[LocalModelService] HF API error for ${repo}: ${resp.status} ${resp.statusText}`);
        throw new Error(`HF API error: ${resp.status} ${resp.statusText}`);
      }
      const data = await resp.json() as any;
      if (!data.siblings) {
        console.warn(`[LocalModelService] No siblings field in response for ${repo}`);
        return [];
      }
      return data.siblings
        .filter((s: any) => s.rfilename.endsWith('.gguf'))
        .map((s: any) => s.rfilename);
    } catch (e) {
      console.error(`[LocalModelService] Failed to fetch files for ${repo}:`, e);
      throw e;
    }
  }

  async downloadModel(repo: string, filename: string, onProgress?: (p: DownloadProgress) => void, token?: string): Promise<string> {
    const url = `https://huggingface.co/${repo}/resolve/main/${filename}`;
    const dest = path.join(this.modelsDir, filename);
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
    const total = Number(resp.headers.get('content-length')) || 0;
    const reader = resp.body!.getReader();
    const writer = fs.createWriteStream(dest);
    let downloaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
      downloaded += value.length;
      if (total > 0 && onProgress) {
        onProgress({ downloaded, total, percent: Math.round((downloaded / total) * 100) });
      }
    }
    writer.end();
    return dest;
  }

  private findLlamaServer(): string | null {
    const userDataBin = path.join(app.getPath('userData'), 'bin');
    const candidates = [
      path.join(userDataBin, 'llama-srv.exe'),
      path.join(userDataBin, 'llama-server.exe'),
      app.isPackaged
        ? path.join(process.resourcesPath, 'llama-srv.exe')
        : path.join(process.env.APP_ROOT || process.cwd(), 'resources', 'llama-srv.exe'),
      app.isPackaged
        ? path.join(process.resourcesPath, 'llama-server.exe')
        : path.join(process.env.APP_ROOT || process.cwd(), 'resources', 'llama-server.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  startServer(modelPath: string, contextSize?: number): Promise<number> {
    const modelName = path.basename(modelPath);
    const modelMaxCtx = resolveModelMaxContext(modelName);
    const target = contextSize ?? modelMaxCtx;
    const ctx = clampContextByHardware(modelPath, target);
    this.serverContextSize = ctx;
    if (ctx !== target) {
      console.log(`[LocalModelService] Context clamped: requested=${target} modelMax=${modelMaxCtx} actual=${ctx}`);
    }
    if (this.serverProcess) {
      this.runningModel = modelName;
      return Promise.resolve(this.serverPort);
    }
    return new Promise((resolve, reject) => {
      const llamaBin = this.findLlamaServer();
      if (!llamaBin) {
        reject(new Error(`llama-server.exe not found. This is often caused by antivirus (Norton, Defender) falsely flagging it as "IDP.Generic" and quarantining it. Run "npm run fetch:llama" to re-download, or add ${app.getPath('userData')}\\bin to your antivirus exclusions.`));
        return;
      }
      const proc = spawn(llamaBin, [
        '-m', modelPath,
        '--host', '127.0.0.1',
        '--port', String(this.serverPort),
        '-ngl', '0',
        '-c', String(ctx),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      this.serverProcess = proc;
      this.runningModel = modelName;
      let started = false;
      const cleanup = () => {
        proc.stdout?.removeAllListeners('data');
        proc.stderr?.removeAllListeners('data');
        proc.removeAllListeners('error');
        proc.removeAllListeners('close');
      };
      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        if (!started && (text.includes('starting') || text.includes('listening') || text.includes('build'))) {
          started = true;
          cleanup();
          resolve(this.serverPort);
        }
      });
      proc.on('error', (err) => {
        this.serverProcess = null;
        this.runningModel = null;
        cleanup();
        reject(err);
      });
      proc.on('close', (code) => {
        this.serverProcess = null;
        this.runningModel = null;
        cleanup();
        if (!started) {
          reject(new Error(`llama-server exited immediately (code ${code}). The binary may be corrupted, missing DLLs, or blocked by antivirus. Run "npm run fetch:llama" to re-download.`));
        }
      });
      setTimeout(() => {
        if (!started) {
          started = true;
          cleanup();
          resolve(this.serverPort);
        }
      }, 15000);
    });
  }

  stopServer(): void {
    if (!this.serverProcess) return;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${this.serverProcess.pid}`, { timeout: 3000 });
      } else {
        this.serverProcess.kill('SIGTERM');
      }
    } catch {}
    this.serverProcess = null;
    this.runningModel = null;
  }

  isServerRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  getRunningModel(): string | null {
    if (this.isServerRunning()) {
      return this.runningModel;
    }
    return null;
  }

  getServerPort(): number {
    return this.serverPort;
  }

  getContextSize(): number {
    return this.serverContextSize;
  }

  restartServer(contextSize: number): Promise<number> {
    const modelPath = this.runningModel ? path.join(this.modelsDir, this.runningModel) : null;
    if (!modelPath || !fs.existsSync(modelPath)) {
      return Promise.reject(new Error('No running model to restart'));
    }
    this.stopServer();
    return this.startServer(modelPath, contextSize);
  }
}
