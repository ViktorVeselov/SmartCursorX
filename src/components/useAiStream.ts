import { useEffect, useRef } from 'react';

export function useAiStream() {
    const activeChunkListenerRef = useRef<((_: unknown, chunk: any) => void) | null>(null);
    const activeEndListenerRef = useRef<(() => void) | null>(null);
    const streamActiveRef = useRef(false);
    const activePrefixRef = useRef<string | null>(null);

    const cleanupActiveListeners = () => {
        streamActiveRef.current = false;
        const prefix = activePrefixRef.current || 'ai:chat';
        if (activeChunkListenerRef.current) {
            window.ipcRenderer.off(`${prefix}-chunk`, activeChunkListenerRef.current);
            activeChunkListenerRef.current = null;
        }
        if (activeEndListenerRef.current) {
            window.ipcRenderer.off(`${prefix}-end`, activeEndListenerRef.current);
            activeEndListenerRef.current = null;
        }
        activePrefixRef.current = null;
    };

    const registerAiStreamHandlers = (
        onChunk: (_: unknown, chunk: any) => void,
        onEnd: (...args: any[]) => void | Promise<void>,
        channelPrefix = 'ai:chat'
    ) => {
        cleanupActiveListeners();
        streamActiveRef.current = true;
        activePrefixRef.current = channelPrefix;

        const handleChunk = (_: unknown, chunk: any) => {
            if (!streamActiveRef.current) return;
            onChunk(_, chunk);
        };

        const handleEnd = async (...args: any[]) => {
            if (!streamActiveRef.current) return;
            streamActiveRef.current = false;
            cleanupActiveListeners();
            await onEnd(...args);
        };

        activeChunkListenerRef.current = handleChunk;
        activeEndListenerRef.current = handleEnd;
        window.ipcRenderer.on(`${channelPrefix}-chunk`, handleChunk);
        window.ipcRenderer.once(`${channelPrefix}-end`, handleEnd);
    };

    useEffect(() => {
        return () => {
            cleanupActiveListeners();
        };
    }, []);

    return { registerAiStreamHandlers, cleanupActiveListeners };
}
