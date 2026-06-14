import { app, BrowserWindow, Menu } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// import { store } from './store'
import { dbService } from './db'
import { registerAllHandlers } from './ipcHandlers'
import type { IpcHandlerContext } from './ipcHandlers'
import { adminApiService } from './services/AdminApiService'
import { checkCommandLineTests } from './testRunner'
import { aiService } from './services/AIService'

console.log(' [Main] Starting Electron Main Process...');

// Suppress AI SDK warnings (Gemini structured output fallback, etc.)
(globalThis as any).AI_SDK_LOG_WARNINGS = false;

// Override console.assert to throw Errors instead of silently logging (NASA Rule #5)
console.assert = function(condition: any, message?: string, ...args: any[]) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message || 'Assert failed'} ${args.join(' ')}`);
  }
};

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Polyfill for dependencies that expect __dirname (like sql.js or node-pty)
Object.assign(global, { __dirname, require });

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// Import native module
const nativePath = app.isPackaged
  ? path.join(process.resourcesPath, 'native')
  : path.join(process.env.APP_ROOT, 'native')

let native: typeof import('../native')
try {
  native = require(nativePath)
  console.log('Native module loaded:', native.nativeHealthCheck())
} catch (err) {
  console.error('Failed to load native module:', err)
}

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  console.log(' [Main] Creating Window...');
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#121214',
      symbolColor: '#f3f4f6',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Security: Context Isolation is true by default in Electron 12+
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.platform !== 'darwin') {
    win.removeMenu();
  }

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    console.log(' [Main] Loading URL:', VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  adminApiService.stop();
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

function createDefaultMenu() {
  const template: any[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  console.log(' [Main] App Ready');
  createDefaultMenu();
  try {
    // Initialize Database
    console.log(' [Main] Initializing DB...');
    await dbService.init()
    console.log(' [Main] DB Initialized');

    // Initialize AI Service
    console.log(' [Main] Initializing AI Service...');
    aiService.initializeFromStore();
    console.log(' [Main] AI Service Initialized');

    // Decoupled CLI integration test suite runner
    await checkCommandLineTests();

    // Start Admin HTTP server
    console.log(' [Main] Starting Admin REST API Server...');
    adminApiService.start();

    // Initialize IPC Handlers
    const ipcContext: IpcHandlerContext = { mainWindow: null, native, ptyProcesses: new Map(), activeStreamAborted: false };
    registerAllHandlers(ipcContext);
    console.log(' [Main] Handlers Registered');

    // Create Window
    createWindow();

    if (win) {
      ipcContext.mainWindow = win;
    }
  } catch (err) {
    console.error(' [Main] Error during startup:', err);
  }
})
