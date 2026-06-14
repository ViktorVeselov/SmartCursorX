import { ipcRenderer, contextBridge } from 'electron'

const ALLOWED_INVOKE_CHANNELS = new Set([
  'doc:generate', 'doc:get', 'verify:run', 'verify:get-rules', 'verify:add-rule',
  'verify:get-results', 'verify:human-review', 'rag:search', 'rag:index-content',
  'task:create', 'task:decompose', 'task:start', 'task:complete', 'task:fail',
  'task:get-tree', 'task:assemble-context', 'task:get-execution-details', 'code:get-symbols', 'code:find-references',
  'code:get-call-hierarchy', 'code:get-workspace-outline', 'native-search',
  'native-health-check', 'read-dir', 'read-file', 'write-file', 'delete-path',
  'rename-path', 'create-directory', 'resolve-path', 'dialog-open-folder',
  'dialog-save-file', 'dialog-open-file', 'get-api-key', 'set-api-key',
  'get-github-token', 'set-github-token', 'ai:test-connection', 'db-add-memory',
  'db-get-memories', 'db-delete-memory', 'db-get-agents', 'db-add-agent',
  'db-delete-agent', 'db-get-flows', 'db-add-flow', 'db-delete-flow',
  'db-update-flow', 'ai:get-custom-providers', 'ai:get-provider-key',
  'ai:add-custom-provider', 'ai:delete-custom-provider', 'ai:get-custom-models',
  'ai:add-custom-model', 'ai:toggle-model-thinking', 'ai:delete-custom-model',
  'litellm:get-status', 'litellm:stop', 'litellm:start', 'term-init',
  'term-input', 'term-resize', 'term-close', 'vc-create-snapshot',
  'vc-get-snapshots', 'vc-restore-snapshot', 'git-status', 'git-branch',
  'git-clone', 'git-diff', 'ai:save-config', 'ai:get-config', 'ai:get-models', 'ai:get-zen-models-info', 'ai:get-model-context-length',
  'get-general-settings', 'save-general-settings', 'openclaw:check-installed',
  'openclaw:get-status', 'openclaw:start-gateway', 'openclaw:stop-gateway',
  'openclaw:run-doctor', 'openclaw:approve-pairing', 'openclaw:run-agent',
  'openclaw:get-logs', 'ai:get-usage-stats', 'ai:clear-usage-stats',
  'chat:create-conv', 'chat:get-convs', 'chat:get-messages', 'chat:add-message', 'chat:update-message',
  'chat:delete-conv', 'chat:update-title', 'chat:truncate-from-message', 'chat:fork-conv', 'plan:get', 'plan:save', 'secure:list-keys', 'test:secure-run',
  'db:get-rules', 'db:add-rule', 'db:update-rule', 'db:delete-rule', 'db:toggle-rule',
  'execution:start', 'execution:get-pending', 'execution:apply-pending', 'execution:reject-pending',
  'execution:apply-single', 'execution:reject-single', 'execution:has-pending'
]);

const ALLOWED_SEND_CHANNELS = new Set([
  'ai:chat-start',
  'ai:chat-abort',
  'ai:plan-start',
  'renderer:log'
]);

const ALLOWED_ON_CHANNELS = new Set([
  'terminal-incoming', 'terminal-exit', 'git-clone-progress', 'ai:chat-chunk',
  'ai:chat-end', 'ai:plan-chunk', 'ai:plan-end',
  'openclaw:agent-stream', 'openclaw:agent-complete', 'main-process-message',
  'execution:pending-modifications'
]);

// Map to track active subscription wrappers to ensure ipcRenderer.off can correctly unregister them
const subscriptionMap = new Map<(...args: any[]) => void, (event: any, ...args: any[]) => void>();

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (...args: any[]) => void) {
    if (!ALLOWED_ON_CHANNELS.has(channel)) {
      console.warn(`[Preload Security] Blocked listener registration on unauthorized IPC channel: ${channel}`);
      return () => {};
    }
    let subscription = subscriptionMap.get(listener);
    if (!subscription) {
      subscription = (event: any, ...args: any[]) => listener(event, ...args);
      subscriptionMap.set(listener, subscription);
    }
    ipcRenderer.on(channel, subscription);
    // Return a disposer function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, subscription!);
      subscriptionMap.delete(listener);
    };
  },
  off(channel: string, listener: (...args: any[]) => void) {
    if (!ALLOWED_ON_CHANNELS.has(channel)) {
      console.warn(`[Preload Security] Blocked listener removal on unauthorized IPC channel: ${channel}`);
      return;
    }
    const subscription = subscriptionMap.get(listener);
    if (subscription) {
      ipcRenderer.removeListener(channel, subscription);
      subscriptionMap.delete(listener);
    } else {
      ipcRenderer.off(channel, listener);
    }
  },
  send(channel: string, ...args: any[]) {
    if (!ALLOWED_SEND_CHANNELS.has(channel)) {
      console.warn(`[Preload Security] Blocked event send on unauthorized IPC channel: ${channel}`);
      return;
    }
    return ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: any[]) {
    if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`[Preload Security] Blocked invoke on unauthorized IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  once(channel: string, listener: (...args: any[]) => void) {
    if (!ALLOWED_ON_CHANNELS.has(channel)) {
      console.warn(`[Preload Security] Blocked one-time listener registration on unauthorized IPC channel: ${channel}`);
      return;
    }
    let subscription = subscriptionMap.get(listener);
    if (!subscription) {
      subscription = (_event: any, ...args: any[]) => {
        subscriptionMap.delete(listener);
        listener(...args);
      };
      subscriptionMap.set(listener, subscription);
    }
    ipcRenderer.once(channel, subscription);
  },
})
