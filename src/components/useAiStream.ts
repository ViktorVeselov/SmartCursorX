import { useEffect, useRef } from 'react';

export function useAiStream() {
    const activeChunkListenerRef = useRef<((_: unknown, chunk: string) => void) | null>(null);
    const activeEndListenerRef = useRef<(() => void) | null>(null);
    const streamActiveRef = useRef(false);

    const cleanupActiveListeners = () => {
        streamActiveRef.current = false;
        if (activeChunkListenerRef.current) {
            window.ipcRenderer.off('ai:chat-chunk', activeChunkListenerRef.current);
            activeChunkListenerRef.current = null;
        }
        if (activeEndListenerRef.current) {
            window.ipcRenderer.off('ai:chat-end', activeEndListenerRef.current);
            activeEndListenerRef.current = null;
        }
    };

    const registerAiStreamHandlers = (onChunk: (_: unknown, chunk: string) => void, onEnd: () => void | Promise<void>) => {
        cleanupActiveListeners();
        streamActiveRef.current = true;

        const handleChunk = (_: unknown, chunk: string) => {
            if (!streamActiveRef.current) return;
            onChunk(_, chunk);
        };

        const handleEnd = async () => {
            if (!streamActiveRef.current) return;
            streamActiveRef.current = false;
            cleanupActiveListeners();
            await onEnd();
        };

        activeChunkListenerRef.current = handleChunk;
        activeEndListenerRef.current = handleEnd;
        window.ipcRenderer.on('ai:chat-chunk', handleChunk);
        window.ipcRenderer.once('ai:chat-end', handleEnd);
    };

    useEffect(() => {
        return () => {
            cleanupActiveListeners();
        };
    }, []);

    return { registerAiStreamHandlers, cleanupActiveListeners };
}
