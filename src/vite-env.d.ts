/// <reference types="vite/client" />

interface IpcRendererWrapper {
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): () => void;
    off(channel: string, ...args: unknown[]): void;
    send(channel: string, ...args: unknown[]): void;
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

declare global {
    interface Window {
        ipcRenderer: IpcRendererWrapper
    }
}

declare module 'prismjs';
