import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { finetuningService } from '../services/FinetuningService'
import { secureStore } from '../secureStore'
import { auditLogger } from '../services/AuditLogger'
import { DatasetConfig } from '../constants/models'
import { HardwareSpec } from '../services/backends/BaseFinetuneBackend'
import { checkArgs } from '../../src/helpers/invariant'

export function registerFinetuningHandlers(_ipcMain: Electron.IpcMain) {
  let progressUnsub: (() => void) | null = null

  ipcMain.handle('finetune:detect-hardware', async () => {
    return await finetuningService.detectHardware()
  })

  ipcMain.handle('finetune:refresh-hardware', async () => {
    return await finetuningService.detectHardware(true)
  })

  ipcMain.handle('finetune:get-models', () => {
    return finetuningService.getModels()
  })

  ipcMain.handle('finetune:get-state', () => {
    return finetuningService.getState()
  })

  ipcMain.handle('finetune:get-recommendation', async (_event, hardware?: HardwareSpec) => {
    const hw = hardware || await finetuningService.detectHardware()
    return finetuningService.getRecommendation(hw)
  })

  ipcMain.handle('finetune:prepare-dataset', async (_event, workspacePath: string, config?: DatasetConfig) => {
    return await finetuningService.prepareDataset(workspacePath, config)
  })

  ipcMain.handle('finetune:export-dataset', async (_event, outputPath?: string) => {
    return await finetuningService.exportDataset(outputPath)
  })

  ipcMain.handle('finetune:start', async (_event, options: any) => {
    auditLogger.log('finetune:start', [options?.modelId, options?.datasetPath]);
    if (progressUnsub) progressUnsub()

    progressUnsub = finetuningService.onProgress((event) => {
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
      if (win) {
        win.webContents.send('finetune:progress', event)
      }
    })

    // Save Hugging Face token securely if passed
    if (options.huggingfaceToken !== undefined) {
      if (options.huggingfaceToken) {
        // Only save if it looks like a valid hf_ token to prevent format exceptions
        if (options.huggingfaceToken.startsWith('hf_')) {
          secureStore.setHuggingFaceToken(options.huggingfaceToken);
        }
      } else {
        secureStore.deleteHuggingFaceToken();
      }
    }

    await finetuningService.startTraining(options)
    return { success: true }
  })

  ipcMain.handle('finetune:stop', async () => {
    auditLogger.log('finetune:stop', []);
    if (progressUnsub) { progressUnsub(); progressUnsub = null }
    await finetuningService.stopTraining()
    return { success: true }
  })

  ipcMain.handle('finetune:reset', async () => {
    await finetuningService.reset()
    return { success: true }
  })

  ipcMain.handle('finetune:get-adapter-path', () => {
    return finetuningService.getAdapterPath()
  })

  ipcMain.handle('finetune:get-builtin-dataset', () => {
    return finetuningService.getBuiltinDatasetInfo()
  })

  ipcMain.handle('finetune:check-packages', async () => {
    return await finetuningService.checkPackages()
  })

  ipcMain.handle('finetune:install-dependencies', async () => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    const sendLog = (msg: string) => {
      if (win) {
        win.webContents.send('finetune:progress', { type: 'log', message: msg })
      }
    }
    await finetuningService.installDependencies(sendLog)
    return { success: true }
  })

  ipcMain.handle('finetune:convert-dataset', async (_event, params: {
    inputPath: string;
    outputPath: string;
    mode?: string;
    maxSamples?: number;
    filterTruncated?: boolean;
  }) => {
    auditLogger.log('finetune:convert-dataset', [params.inputPath, params.outputPath, params.mode]);
    checkArgs(params && typeof params.inputPath === 'string', 'inputPath must be a string');
    checkArgs(typeof params.outputPath === 'string', 'outputPath must be a string');

    const scriptPath = 'scripts/convert_cot_dataset.py';
    const args = [
      scriptPath,
      '--input', params.inputPath,
      '--output', params.outputPath,
      '--mode', params.mode || 'instruction',
      '--max-samples', String(params.maxSamples || 2000),
    ];
    if (params.filterTruncated !== false) args.push('--filter-truncated');

    return new Promise((resolve, reject) => {
      const proc = spawn('python', args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        else reject(new Error(stderr.trim() || `process exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  })
}
