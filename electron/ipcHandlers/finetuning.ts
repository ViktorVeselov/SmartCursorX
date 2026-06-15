import { ipcMain, BrowserWindow } from 'electron'
import { finetuningService } from '../services/FinetuningService'
import { DatasetConfig } from '../constants/models'

export function registerFinetuningHandlers(_ipcMain: Electron.IpcMain) {
  let progressUnsub: (() => void) | null = null

  ipcMain.handle('finetune:detect-hardware', async () => {
    return await finetuningService.detectHardware()
  })

  ipcMain.handle('finetune:get-models', () => {
    return finetuningService.getModels()
  })

  ipcMain.handle('finetune:get-state', () => {
    return finetuningService.getState()
  })

  ipcMain.handle('finetune:get-recommendation', async () => {
    const hw = await finetuningService.detectHardware()
    return finetuningService.getRecommendation(hw)
  })

  ipcMain.handle('finetune:prepare-dataset', async (_event, workspacePath: string, config?: DatasetConfig) => {
    return await finetuningService.prepareDataset(workspacePath, config)
  })

  ipcMain.handle('finetune:export-dataset', async (_event, outputPath?: string) => {
    return await finetuningService.exportDataset(outputPath)
  })

  ipcMain.handle('finetune:start', async (_event, options: any) => {
    if (progressUnsub) progressUnsub()

    progressUnsub = finetuningService.onProgress((event) => {
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
      if (win) {
        win.webContents.send('finetune:progress', event)
      }
    })

    await finetuningService.startTraining(options)
    return { success: true }
  })

  ipcMain.handle('finetune:stop', async () => {
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
}
