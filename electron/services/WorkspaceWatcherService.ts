import { BrowserWindow } from 'electron';
import chokidar from 'chokidar';

export class WorkspaceWatcherService {
    private static instance: WorkspaceWatcherService;
    private watcher: chokidar.FSWatcher | null = null;
    private mainWindow: BrowserWindow | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;

    private constructor() {}

    static getInstance(): WorkspaceWatcherService {
        if (!WorkspaceWatcherService.instance) {
            WorkspaceWatcherService.instance = new WorkspaceWatcherService();
        }
        return WorkspaceWatcherService.instance;
    }

    setMainWindow(win: BrowserWindow) {
        this.mainWindow = win;
    }

    watch(workspacePath: string) {
        // Clean up existing watcher first
        this.stop();

        if (!workspacePath || !workspacePath.trim()) {
            console.log('[WorkspaceWatcherService] Workspace path is empty, not starting watcher.');
            return;
        }

        console.log(`[WorkspaceWatcherService] Starting watcher on: ${workspacePath}`);

        try {
            this.watcher = chokidar.watch(workspacePath, {
                ignored: [
                    /(^|[/\\])\../, // ignore dotfiles
                    '**/node_modules/**',
                    '**/.git/**',
                    '**/.plans/**',
                    '**/.pytest_cache/**',
                    '**/dist/**',
                    '**/dist-electron/**',
                    '**/release/**',
                    '**/__pycache__/**',
                    '**/.venv/**',
                    '**/.next/**',
                    '**/.cache/**',
                    '**/.vscode/**'
                ],
                persistent: true,
                ignoreInitial: true,
                depth: 99
            });

            const notifyChange = () => {
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }
                this.debounceTimer = setTimeout(() => {
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        console.log('[WorkspaceWatcherService] Sending workspace:files-changed to renderer');
                        this.mainWindow.webContents.send('workspace:files-changed');
                    }
                }, 200);
            };

            this.watcher
                .on('add', notifyChange)
                .on('change', notifyChange)
                .on('unlink', notifyChange)
                .on('addDir', notifyChange)
                .on('unlinkDir', notifyChange)
                .on('error', (error) => {
                    console.error('[WorkspaceWatcherService] Watcher error:', error);
                });

        } catch (err) {
            console.error('[WorkspaceWatcherService] Failed to initialize watcher:', err);
        }
    }

    stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.watcher) {
            console.log('[WorkspaceWatcherService] Stopping watcher');
            this.watcher.close().catch((err) => {
                console.error('[WorkspaceWatcherService] Error closing watcher:', err);
            });
            this.watcher = null;
        }
    }
}
