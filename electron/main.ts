import { app, BrowserWindow, Menu } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
// import { store } from './store'
import { dbService } from './db'
import { IpcManager } from './ipcHandlers'
import { adminApiService } from './services/AdminApiService'

console.log(' [Main] Starting Electron Main Process...');

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

    if (process.argv.includes('--test-secure-store')) {
      console.log(' [Main] Running test-secure-store integration test...');
      try {
        const testPath = path.join(process.cwd(), 'scripts/test-secure-store.js');
        const testUrl = pathToFileURL(testPath).href;
        // @ts-ignore
        const { runTests } = await import(testUrl);
        const { secureStore } = await import('./secureStore');
        await runTests(secureStore, dbService);
        app.quit();
        return;
      } catch (testErr) {
        console.error(' [Main] Test execution failed:', testErr);
        app.exit(1);
        return;
      }
    }

    // Start Admin HTTP server
    console.log(' [Main] Starting Admin REST API Server...');
    adminApiService.start();

    // Initialize IPC Manager
    const ipcManager = new IpcManager(native);
    ipcManager.registerHandlers();
    console.log(' [Main] Handlers Registered');

    // Create Window
    createWindow();

    if (win) {
      ipcManager.setWindow(win);
    }
  } catch (err) {
    console.error(' [Main] Error during startup:', err);
  }
})
