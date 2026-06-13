export type AiStreamOwner = 'chat' | 'plan-editor';

let activeOwner: AiStreamOwner | null = null;

export function claimAiStream(owner: AiStreamOwner): void {
    const msg = `[StreamGate] claimAiStream('${owner}'): previous owner=${activeOwner}, new owner=${owner}`;
    console.log(msg);
        try { window.ipcRenderer?.send('renderer:log', 'info', msg); } catch {}
    activeOwner = owner;
}

export function releaseAiStream(owner: AiStreamOwner): void {
    if (activeOwner === owner) {
        const msg = `[StreamGate] releaseAiStream('${owner}'): releasing, owner was=${activeOwner}`;
        console.log(msg);
    try { window.ipcRenderer?.send('renderer:log', 'info', msg); } catch {}
        activeOwner = null;
    } else {
        const msg = `[StreamGate] releaseAiStream('${owner}'): MISMATCH - current owner is '${activeOwner}', cannot release`;
        console.warn(msg);
        try { window.ipcRenderer?.send('renderer:log', 'warn', msg); } catch {}
    }
}

export function isAiStreamOwner(owner: AiStreamOwner): boolean {
    const result = activeOwner === owner;
    if (!result) {
        const msg = `[StreamGate] isAiStreamOwner('${owner}'): FALSE - chunks will be dropped (activeOwner=${activeOwner})`;
        console.warn(msg);
        try { window.ipcRenderer?.send('renderer:log', 'warn', msg); } catch {}
    }
    return result;
}

export function getAiStreamOwner(): AiStreamOwner | null {
    return activeOwner;
}
