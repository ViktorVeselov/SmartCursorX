/**
 * Renderer-side logging helper that routes logs to the main process terminal.
 * This allows seeing renderer logs in `npm run dev` output.
 */
export function rLog(...args: unknown[]) {
    try {
        window.ipcRenderer?.send('renderer:log', 'info', ...args);
    } catch {}
    console.log(...args);
}

export function rWarn(...args: unknown[]) {
    try {
        window.ipcRenderer?.send('renderer:log', 'warn', ...args);
    } catch {}
    console.warn(...args);
}

export function rError(...args: unknown[]) {
    try {
        window.ipcRenderer?.send('renderer:log', 'error', ...args);
    } catch {}
    console.error(...args);
}
