export interface FileItem {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileItem[];
}

export async function loadDir(path: string): Promise<FileItem[]> {
    try {
        const files = await window.ipcRenderer.invoke('read-dir', path);
        return files.map((f: Record<string, unknown>) => ({ ...f, children: undefined }));
    } catch (err) {
        console.error('Failed to load directory:', err);
        return [];
    }
}
