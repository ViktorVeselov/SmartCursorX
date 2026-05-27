import { useState, useEffect } from 'react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'general' | 'models' | 'agent' | 'openclaw' | 'local';

const getIpc = () => (window as any).ipcRenderer;

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    if (!isOpen) return null;

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    // General & Agent State
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [fontSize, setFontSize] = useState(14);
    const [allowFileRead, setAllowFileRead] = useState(false);
    const [autoApproveCommands, setAutoApproveCommands] = useState(false);
    const [systemPromptOverride, setSystemPromptOverride] = useState('');

    // Dynamic Model Provider State
    const [modelProvider, setModelProvider] = useState('openai');
    const [openAIKey, setOpenAIKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [githubToken, setGithubToken] = useState('');

    // Dynamic models selection inside Settings
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('gpt-4o');

    // Dynamic Custom Providers & Models States
    const [customProviders, setCustomProviders] = useState<any[]>([]);
    const [customApiKey, setCustomApiKey] = useState('');
    const [showAddCustomProvider, setShowAddCustomProvider] = useState(false);
    const [customProviderId, setCustomProviderId] = useState('');
    const [customProviderName, setCustomProviderName] = useState('');
    const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState('');
    const [customProviderApiKey, setCustomProviderApiKey] = useState('');
    const [customProviderIsLocal, setCustomProviderIsLocal] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [customModelsList, setCustomModelsList] = useState<any[]>([]);
    const [modelSearchQuery, setModelSearchQuery] = useState('');

    // LiteLLM Local Proxy states
    const [enableLiteLLMProxy, setEnableLiteLLMProxy] = useState(false);
    const [liteLLMConfigPath, setLiteLLMConfigPath] = useState('');
    const [liteLLMModel, setLiteLLMModel] = useState('gpt-4o');
    const [liteLLMPort, setLiteLLMPort] = useState(4000);
    const [isProxyRunning, setIsProxyRunning] = useState(false);

    // Enterprise Cloud Credentials
    const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
    const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
    const [awsRegion, setAwsRegion] = useState('us-east-1');
    const [vertexProject, setVertexProject] = useState('');
    const [vertexLocation, setVertexLocation] = useState('us-central1');
    const [azureApiKey, setAzureApiKey] = useState('');
    const [azureApiBase, setAzureApiBase] = useState('');
    const [azureApiVersion, setAzureApiVersion] = useState('2024-02-01');

    // OpenClaw Integration states
    const [openClawInstalled, setOpenClawInstalled] = useState(false);
    const [openClawIsRunning, setOpenClawIsRunning] = useState(false);
    const [openClawVersion, setOpenClawVersion] = useState('');
    const [openClawPort, setOpenClawPort] = useState(3037);
    const [openClawLogs, setOpenClawLogs] = useState<string[]>([]);
    const [doctorLogs, setDoctorLogs] = useState('');
    const [doctorRunning, setDoctorRunning] = useState(false);
    const [pairingChannel, setPairingChannel] = useState('whatsapp');
    const [pairingCode, setPairingCode] = useState('');
    const [pairingStatus, setPairingStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
    const [isPairingRunning, setIsPairingRunning] = useState(false);

    // Load initial settings securely
    useEffect(() => {
        const loadSettings = async () => {
            const settings = await getIpc().invoke('get-general-settings');
            console.assert(settings !== null && typeof settings === 'object', 'Loaded settings must be valid');
            if (settings) {
                setTheme(settings.theme || 'dark');
                setFontSize(settings.fontSize || 14);
                setModelProvider(settings.activeProvider || 'openai');
                setSelectedModel(settings.selectedModel || 'gpt-4o');
                setAllowFileRead(!!settings.allowFileRead);
                setAutoApproveCommands(!!settings.autoApproveCommands);
                setSystemPromptOverride(settings.systemPromptOverride || '');

                // Load LiteLLM and Cloud variables from settings JSON
                setEnableLiteLLMProxy(!!settings.enableLiteLLMProxy);
                setLiteLLMConfigPath(settings.liteLLMConfigPath || '');
                setLiteLLMModel(settings.liteLLMModel || 'gpt-4o');
                setLiteLLMPort(settings.liteLLMPort || 4000);
                setAwsRegion(settings.awsRegion || 'us-east-1');
                setVertexProject(settings.vertexProject || '');
                setVertexLocation(settings.vertexLocation || 'us-central1');
                setAzureApiBase(settings.azureApiBase || '');
                setAzureApiVersion(settings.azureApiVersion || '2024-02-01');
            }

            // Fetch stored encrypted keys
            const oKey = await getIpc().invoke('ai:get-provider-key', 'openai');
            if (oKey) setOpenAIKey(oKey);

            const aKey = await getIpc().invoke('ai:get-provider-key', 'anthropic');
            if (aKey) setAnthropicKey(aKey);

            const gh = await getIpc().invoke('get-github-token');
            if (gh) setGithubToken(gh);

            // Fetch stored enterprise credentials securely
            const keyAwsId = await getIpc().invoke('ai:get-provider-key', 'awsAccessKeyId');
            if (keyAwsId) setAwsAccessKeyId(keyAwsId);

            const keyAwsSecret = await getIpc().invoke('ai:get-provider-key', 'awsSecretAccessKey');
            if (keyAwsSecret) setAwsSecretAccessKey(keyAwsSecret);

            const keyAzure = await getIpc().invoke('ai:get-provider-key', 'azureApiKey');
            if (keyAzure) setAzureApiKey(keyAzure);

            // Fetch custom providers
            const providers = await getIpc().invoke('ai:get-custom-providers');
            setCustomProviders(providers || []);

            // Check if local proxy is actively running
            const proxyStatus = await getIpc().invoke('litellm:get-status');
            setIsProxyRunning(!!proxyStatus?.isActive);
        };
        loadSettings();
    }, [isOpen]);

    // OpenClaw Status Polling and detection hook
    useEffect(() => {
        if (!isOpen || activeTab !== 'openclaw') return;

        const checkStatus = async () => {
            try {
                const installed = await getIpc().invoke('openclaw:check-installed');
                setOpenClawInstalled(installed);
                if (installed) {
                    const status = await getIpc().invoke('openclaw:get-status');
                    setOpenClawIsRunning(status.isRunning);
                    setOpenClawVersion(status.version);
                    setOpenClawLogs(status.logs || []);
                }
            } catch (e) {
                console.error('Failed to poll OpenClaw status:', e);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000);
        return () => clearInterval(interval);
    }, [isOpen, activeTab]);

    // Load dynamic models list and provider specifics when provider or customProviders change
    useEffect(() => {
        const fetchProviderDetails = async () => {
            const list = await getIpc().invoke('ai:get-models', modelProvider);
            console.assert(Array.isArray(list), 'Fetched models list must be an array');
            setAvailableModels(list || []);
            // Set default model on provider switch
            if (list && list.length > 0) {
                if (!list.includes(selectedModel)) {
                    setSelectedModel(list[0]);
                }
            }

            // Fetch custom models from DB
            const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
            setCustomModelsList(dbModels || []);

            // Load custom API key if custom provider
            const custom = customProviders.find((p: any) => p.id === modelProvider);
            if (custom) {
                const key = await getIpc().invoke('ai:get-provider-key', modelProvider);
                setCustomApiKey(key || custom.api_key || '');
            } else {
                setCustomApiKey('');
            }
        };
        fetchProviderDetails();
    }, [modelProvider, customProviders]);

    const handleSave = async () => {
        // Unify and encrypt API keys
        if (modelProvider === 'openai' && openAIKey) {
            await getIpc().invoke('set-api-key', openAIKey);
        } else if (modelProvider === 'anthropic' && anthropicKey) {
            await getIpc().invoke('ai:save-config', { providerId: 'anthropic', apiKey: anthropicKey });
        } else if (customProviders.some(p => p.id === modelProvider) && customApiKey) {
            await getIpc().invoke('ai:save-config', { providerId: modelProvider, apiKey: customApiKey });
        }

        if (githubToken) {
            await getIpc().invoke('set-github-token', githubToken);
        }

        // Save enterprise cloud keys securely
        if (awsAccessKeyId) {
            await getIpc().invoke('ai:save-config', { providerId: 'awsAccessKeyId', apiKey: awsAccessKeyId });
        }
        if (awsSecretAccessKey) {
            await getIpc().invoke('ai:save-config', { providerId: 'awsSecretAccessKey', apiKey: awsSecretAccessKey });
        }
        if (azureApiKey) {
            await getIpc().invoke('ai:save-config', { providerId: 'azureApiKey', apiKey: azureApiKey });
        }

        // Save active provider config to initialize AIService
        await getIpc().invoke('ai:save-config', {
            providerId: modelProvider,
            apiKey: modelProvider === 'openai' ? openAIKey : modelProvider === 'anthropic' ? anthropicKey : modelProvider === 'ollama' ? '' : customApiKey
        });

        // Save general & agent configuration (including cloud settings)
        await getIpc().invoke('save-general-settings', {
            theme,
            fontSize: Number(fontSize),
            activeProvider: modelProvider,
            selectedModel,
            allowFileRead,
            autoApproveCommands,
            systemPromptOverride,

            // LiteLLM proxy variables
            enableLiteLLMProxy,
            liteLLMConfigPath,
            liteLLMModel,
            liteLLMPort: Number(liteLLMPort),
            awsRegion,
            vertexProject,
            vertexLocation,
            azureApiBase,
            azureApiVersion
        });

        // Orchestrate Proxy Process Lifecycle
        if (enableLiteLLMProxy) {
            await getIpc().invoke('litellm:start', {
                enabled: true,
                port: Number(liteLLMPort),
                model: liteLLMModel,
                configPath: liteLLMConfigPath,
                awsAccessKeyId,
                awsSecretAccessKey,
                awsRegion,
                vertexProject,
                vertexLocation,
                azureApiKey,
                azureApiBase,
                azureApiVersion
            });
        } else {
            await getIpc().invoke('litellm:stop');
        }

        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }} onClick={onClose}>
            <div style={{
                width: 900,
                height: 540,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>

                {/* Sidebar */}
                <div style={{
                    width: 200,
                    background: 'var(--bg-tertiary)',
                    borderRight: '1px solid var(--border-color)',
                    padding: '20px 0',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '0 20px 20px', fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Settings
                    </div>
                    {(() => {
                        const baseTabs = ['general', 'models', 'agent', 'openclaw'];
                        const isLocalProvider = modelProvider === 'ollama' || customProviders.some((p: any) => p.id === modelProvider && p.isLocal);
                        if (isLocalProvider) baseTabs.push('local');
                        return baseTabs.map(tab => (
                            <div
                                key={tab}
                                onClick={() => setActiveTab(tab as SettingsTab)}
                                style={{
                                    padding: '8px 20px',
                                    cursor: 'pointer',
                                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    background: activeTab === tab ? 'var(--bg-active)' : 'transparent',
                                    borderLeft: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                    textTransform: 'capitalize',
                                    fontSize: 13
                                }}
                            >
                                {tab === 'openclaw' ? '🦞 OpenClaw' : tab === 'local' ? 'Local LLMs' : tab}
                            </div>
                        ));
                    })()}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: 30, overflowY: 'auto', paddingBottom: 80 }}>
                    {activeTab === 'general' && (
                        <div>
                            <h3 style={{ marginTop: 0 }}>General</h3>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Theme</label>
                                <select
                                    value={theme}
                                    onChange={e => setTheme(e.target.value as any)}
                                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                                >
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Font Size</label>
                                <input
                                    type="number"
                                    value={fontSize}
                                    onChange={e => setFontSize(Number(e.target.value))}
                                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'models' && (
                        <div style={{ display: 'flex', gap: 24, minHeight: 440, alignItems: 'flex-start' }}>
                            {/* Left Column: API Configuration, Gateways & Enterprise Credentials */}
                            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                                {/* Providers & API Keys */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className="codicon codicon-key" style={{ color: 'var(--accent-primary)' }} />
                                        Models & API Providers
                                    </h3>
                                    
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>Active Provider</label>
                                            <select
                                                value={modelProvider}
                                                onChange={e => setModelProvider(e.target.value)}
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12 }}
                                            >
                                                <option value="openai">OpenAI (Official)</option>
                                                <option value="anthropic">Anthropic (Official)</option>
                                                <option value="ollama">Ollama (Local)</option>
                                                {customProviders.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ flex: 1.2 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>Selected Model</label>
                                            <select
                                                value={selectedModel}
                                                onChange={e => setSelectedModel(e.target.value)}
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12 }}
                                            >
                                                {availableModels.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* API Keys Configuration */}
                                    {modelProvider === 'openai' && (
                                        <div style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>OpenAI API Key</label>
                                            <input
                                                type="password"
                                                value={openAIKey}
                                                onChange={e => setOpenAIKey(e.target.value)}
                                                placeholder="sk-..."
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12, boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    )}

                                    {modelProvider === 'anthropic' && (
                                        <div style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>Anthropic API Key</label>
                                            <input
                                                type="password"
                                                value={anthropicKey}
                                                onChange={e => setAnthropicKey(e.target.value)}
                                                placeholder="sk-ant-..."
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12, boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    )}

                                    {customProviders.some((p: any) => p.id === modelProvider) && (
                                        <div style={{ marginBottom: 0 }}>
                                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                {customProviders.find((p: any) => p.id === modelProvider)?.name} API Key (Optional)
                                            </label>
                                            <input
                                                type="password"
                                                value={customApiKey}
                                                onChange={e => setCustomApiKey(e.target.value)}
                                                placeholder="Enter API key or token if required"
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12, boxSizing: 'border-box' }}
                                            />
                                            <div style={{ marginTop: 8 }}>
                                                <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                                    Local Provider?
                                                </label>
                                                <input
                                                    type="checkbox"
                                                    checked={customProviderIsLocal}
                                                    onChange={e => setCustomProviderIsLocal(e.target.checked)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Custom API Gateways */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="codicon codicon-circuit-board" style={{ color: 'var(--accent-primary)' }} />
                                            Custom API Gateways
                                        </h3>
                                        <button
                                            onClick={() => setShowAddCustomProvider(!showAddCustomProvider)}
                                            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 'var(--radius-md)', fontSize: 10, fontWeight: 500, cursor: 'pointer' }}
                                        >
                                            {showAddCustomProvider ? 'Cancel' : '+ Add Gateway'}
                                        </button>
                                    </div>

                                    {showAddCustomProvider && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={customProviderId}
                                                    onChange={e => setCustomProviderId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                                    placeholder="e.g. openrouter"
                                                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={customProviderName}
                                                    onChange={e => setCustomProviderName(e.target.value)}
                                                    placeholder="OpenRouter Gateway"
                                                    style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={customProviderBaseUrl}
                                                onChange={e => setCustomProviderBaseUrl(e.target.value)}
                                                placeholder="https://openrouter.ai/api/v1"
                                                style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                            />
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    type="password"
                                                    value={customProviderApiKey}
                                                    onChange={e => setCustomProviderApiKey(e.target.value)}
                                                    placeholder="Bearer Key (Optional)"
                                                    style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (!customProviderId.trim() || !customProviderName.trim() || !customProviderBaseUrl.trim()) {
                                                            alert('Please fill in ID, Name, and Base URL.');
                                                            return;
                                                        }
                                                        await getIpc().invoke('ai:add-custom-provider', customProviderId.trim(), customProviderName.trim(), customProviderBaseUrl.trim(), customProviderApiKey.trim() || undefined, customProviderIsLocal);
                                                        setCustomProviderId('');
                                                        setCustomProviderName('');
                                                        setCustomProviderBaseUrl('');
                                                        setCustomProviderApiKey('');
                                                        setCustomProviderIsLocal(false);
                                                        setShowAddCustomProvider(false);
                                                        const list = await getIpc().invoke('ai:get-custom-providers');
                                                        setCustomProviders(list || []);
                                                        setModelProvider(customProviderId.trim());
                                                    }}
                                                    style={{ padding: '5px 12px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {customProviders.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto', paddingRight: 4 }}>
                                            {customProviders.map((p: any) => (
                                                <div
                                                    key={p.id}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        padding: '6px 10px',
                                                        fontSize: 11
                                                    }}
                                                >
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                                                        <span style={{ fontSize: 9, color: 'var(--text-secondary)', marginLeft: 6 }}>({p.id})</span>
                                                    </div>
                                                    <span
                                                        onClick={async () => {
                                                            if (confirm(`Delete ${p.name}?`)) {
                                                                await getIpc().invoke('ai:delete-custom-provider', p.id);
                                                                const list = await getIpc().invoke('ai:get-custom-providers');
                                                                setCustomProviders(list || []);
                                                                if (modelProvider === p.id) {
                                                                    setModelProvider('openai');
                                                                }
                                                            }
                                                        }}
                                                        style={{ color: '#ef4444', fontSize: 11, cursor: 'pointer', fontWeight: 'bold', padding: '2px 4px' }}
                                                        title="Delete Gateway"
                                                    >
                                                        ✕
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                            No custom API gateways configured.
                                        </div>
                                    )}
                                </div>

                                {/* Enterprise Cloud Credentials */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span className="codicon codicon-cloud" style={{ color: 'var(--accent-primary)' }} />
                                        Enterprise Cloud Credentials
                                    </h3>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {/* AWS Bedrock */}
                                        <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Amazon Bedrock</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                                                <input
                                                    type="password"
                                                    value={awsAccessKeyId}
                                                    onChange={e => setAwsAccessKeyId(e.target.value)}
                                                    placeholder="AWS Access Key ID"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <input
                                                    type="password"
                                                    value={awsSecretAccessKey}
                                                    onChange={e => setAwsSecretAccessKey(e.target.value)}
                                                    placeholder="AWS Secret Access Key"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={awsRegion}
                                                onChange={e => setAwsRegion(e.target.value)}
                                                placeholder="AWS Region Name (e.g. us-east-1)"
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                            />
                                        </div>

                                        {/* Google Vertex */}
                                        <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Google Vertex AI</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={vertexProject}
                                                    onChange={e => setVertexProject(e.target.value)}
                                                    placeholder="Google Project ID"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={vertexLocation}
                                                    onChange={e => setVertexLocation(e.target.value)}
                                                    placeholder="Location (e.g. us-central1)"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Azure OpenAI */}
                                        <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Azure OpenAI</div>
                                            <input
                                                type="password"
                                                value={azureApiKey}
                                                onChange={e => setAzureApiKey(e.target.value)}
                                                placeholder="Azure API Key"
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none', marginBottom: 8 }}
                                            />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={azureApiBase}
                                                    onChange={e => setAzureApiBase(e.target.value)}
                                                    placeholder="Azure Base URL (e.g. https://...)"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={azureApiVersion}
                                                    onChange={e => setAzureApiVersion(e.target.value)}
                                                    placeholder="API Version"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* GitHub Token */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>GitHub Personal Access Token</label>
                                    <input
                                        type="password"
                                        value={githubToken}
                                        onChange={e => setGithubToken(e.target.value)}
                                        placeholder="ghp_..."
                                        style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', boxSizing: 'border-box', fontSize: 12 }}
                                    />
                                </div>
                            </div>

                            {/* Middle Visual separator line */}
                            <div style={{ width: 1, background: 'var(--border-color)', alignSelf: 'stretch' }} />

                            {/* Right Column: LiteLLM, Manual Register & Available Models */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                                {/* LiteLLM Local Orchestrator */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="codicon codicon-server-process" style={{ color: 'var(--accent-primary)' }} />
                                            LiteLLM Local Orchestrator
                                        </h4>
                                        <span style={{ fontSize: 9, color: isProxyRunning ? '#4ade80' : 'var(--text-secondary)', background: isProxyRunning ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                            {isProxyRunning ? 'Running' : 'Stopped'}
                                        </span>
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={enableLiteLLMProxy}
                                                onChange={e => setEnableLiteLLMProxy(e.target.checked)}
                                            />
                                            <span style={{ fontSize: 12, fontWeight: 500 }}>Run local LiteLLM Proxy automatically</span>
                                        </label>
                                    </div>

                                    {enableLiteLLMProxy && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Config File Path</label>
                                                    <input
                                                        type="text"
                                                        value={liteLLMConfigPath}
                                                        onChange={e => setLiteLLMConfigPath(e.target.value)}
                                                        placeholder="c:\path\to\config.yaml"
                                                        style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Fallback Model</label>
                                                    <input
                                                        type="text"
                                                        value={liteLLMModel}
                                                        onChange={e => setLiteLLMModel(e.target.value)}
                                                        placeholder="gpt-4o"
                                                        style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', marginBottom: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Local Proxy Port</label>
                                                <input
                                                    type="number"
                                                    value={liteLLMPort}
                                                    onChange={e => setLiteLLMPort(Number(e.target.value))}
                                                    placeholder="4000"
                                                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, boxSizing: 'border-box', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Manual Model Registration */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Add Model Manually</h4>
                                    
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                        <input
                                            type="text"
                                            value={newModelName}
                                            onChange={e => setNewModelName(e.target.value)}
                                            placeholder="model identifier (e.g. o3-mini)"
                                            style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (newModelName.trim()) {
                                                        const name = newModelName.trim();
                                                        const hasTh = name.startsWith('o1') || name.startsWith('o3') || name.includes('r1') || name.includes('reasoner');
                                                        await getIpc().invoke('ai:add-custom-model', modelProvider, name, hasTh);
                                                        setNewModelName('');
                                                        const list = await getIpc().invoke('ai:get-models', modelProvider);
                                                        setAvailableModels(list || []);
                                                        const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                                        setCustomModelsList(dbModels || []);
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={async () => {
                                                if (newModelName.trim()) {
                                                    const name = newModelName.trim();
                                                    const hasTh = name.startsWith('o1') || name.startsWith('o3') || name.includes('r1') || name.includes('reasoner');
                                                    await getIpc().invoke('ai:add-custom-model', modelProvider, name, hasTh);
                                                    setNewModelName('');
                                                    const list = await getIpc().invoke('ai:get-models', modelProvider);
                                                    setAvailableModels(list || []);
                                                    const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                                    setCustomModelsList(dbModels || []);
                                                }
                                            }}
                                            style={{ padding: '6px 14px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Register
                                        </button>
                                    </div>

                                    {customModelsList.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 95, overflowY: 'auto', padding: 2 }}>
                                            {customModelsList.map((m: any) => (
                                                <div
                                                    key={m.model_name}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        background: 'var(--bg-secondary)',
                                                        border: '1px solid var(--border-subtle)',
                                                        color: 'var(--text-primary)',
                                                        padding: '4px 10px',
                                                        borderRadius: 14,
                                                        fontSize: 11
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        {m.model_name}
                                                        {m.has_thinking === 1 && (
                                                            <span className="codicon codicon-beaker" style={{ color: '#a78bfa', fontSize: 10 }} title="Thinking Mode Active" />
                                                        )}
                                                    </span>
                                                    <span
                                                        onClick={async () => {
                                                            await getIpc().invoke('ai:delete-custom-model', modelProvider, m.model_name);
                                                            const list = await getIpc().invoke('ai:get-models', modelProvider);
                                                            setAvailableModels(list || []);
                                                            const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                                            setCustomModelsList(dbModels || []);
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            color: '#ef4444',
                                                            fontWeight: 'bold',
                                                            marginLeft: 4,
                                                            fontSize: 9,
                                                            padding: '0 2px'
                                                        }}
                                                        title="Remove Model"
                                                    >
                                                        ✕
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                            No custom models registered for this provider.
                                        </div>
                                    )}
                                </div>

                                {/* Available Models Explorer */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="codicon codicon-list-selection" style={{ color: 'var(--accent-primary)' }} />
                                            Available Models ({availableModels.length})
                                        </h4>
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                        Search discovered models. Enable beaker <span className="codicon codicon-beaker" /> for reasoning, check-mark to activate in chat list!
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Filter available models..."
                                        value={modelSearchQuery}
                                        onChange={e => setModelSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                                    />

                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, maxHeight: 220 }}>
                                        {availableModels
                                            .filter(m => m.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                                            .map(m => {
                                                const customMatch = customModelsList.find((cm: any) => cm.model_name === m);
                                                const isActive = !!customMatch;
                                                const hasThinking = customMatch ? customMatch.has_thinking === 1 : (m.startsWith('o1-') || m.startsWith('o3-') || m.includes('deepseek-r1') || m.includes('reasoner'));

                                                return (
                                                    <div
                                                        key={m}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '6px 10px',
                                                            background: isActive ? 'var(--bg-active)' : 'rgba(255,255,255,0.01)',
                                                            border: '1px solid var(--border-subtle)',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontSize: 11,
                                                            transition: 'var(--transition-smooth)'
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8, textAlign: 'left' }} title={m}>
                                                            {m}
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            {/* Brain / Thinking Toggle Button */}
                                                            <button
                                                                onClick={async () => {
                                                                    if (isActive) {
                                                                        await getIpc().invoke('ai:toggle-model-thinking', modelProvider, m, !hasThinking);
                                                                    } else {
                                                                        await getIpc().invoke('ai:add-custom-model', modelProvider, m, !hasThinking);
                                                                    }
                                                                    const list = await getIpc().invoke('ai:get-models', modelProvider);
                                                                    setAvailableModels(list || []);
                                                                    const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                                                    setCustomModelsList(dbModels || []);
                                                                }}
                                                                title={hasThinking ? 'Reasoning/Thinking Active (Click to Disable)' : 'Reasoning/Thinking Inactive (Click to Enable)'}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    padding: '2px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    color: hasThinking ? '#a78bfa' : 'var(--text-secondary)',
                                                                    transition: 'var(--transition-smooth)',
                                                                    transform: hasThinking ? 'scale(1.1)' : 'scale(1)'
                                                                }}
                                                            >
                                                                <span className="codicon codicon-beaker" style={{ fontSize: 13 }} />
                                                            </button>

                                                            {/* Active Checkbox / Register Toggle Button */}
                                                            <button
                                                                onClick={async () => {
                                                                    if (isActive) {
                                                                        await getIpc().invoke('ai:delete-custom-model', modelProvider, m);
                                                                    } else {
                                                                        await getIpc().invoke('ai:add-custom-model', modelProvider, m, hasThinking);
                                                                    }
                                                                    const list = await getIpc().invoke('ai:get-models', modelProvider);
                                                                    setAvailableModels(list || []);
                                                                    const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
                                                                    setCustomModelsList(dbModels || []);
                                                                }}
                                                                title={isActive ? 'Deactivate Model' : 'Activate Model'}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    padding: '2px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    color: isActive ? '#10b981' : 'var(--text-secondary)',
                                                                    transition: 'var(--transition-smooth)'
                                                                }}
                                                            >
                                                                <span className={`codicon ${isActive ? 'codicon-checkbox-active' : 'codicon-checkbox'}`} style={{ fontSize: 13 }} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'agent' && (
                        <div>
                            <h3 style={{ marginTop: 0 }}>Agent Configuration</h3>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={allowFileRead}
                                        onChange={e => setAllowFileRead(e.target.checked)}
                                    />
                                    <span style={{ fontSize: 13 }}>Always allow file read</span>
                                </label>
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={autoApproveCommands}
                                        onChange={e => setAutoApproveCommands(e.target.checked)}
                                    />
                                    <span style={{ fontSize: 13 }}>Auto-approve terminal commands (Dangerous)</span>
                                </label>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>System Prompt Override</label>
                                <textarea
                                    rows={6}
                                    value={systemPromptOverride}
                                    onChange={e => setSystemPromptOverride(e.target.value)}
                                    placeholder="You are a helpful coding assistant..."
                                    style={{ width: '100%', padding: 8, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'openclaw' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ marginTop: 0, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 20 }}>🦞</span> OpenClaw Personal AI Assistant
                                </h3>
                                <span style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    background: 'var(--bg-active)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'monospace'
                                }}>
                                    CLI Status: {openClawInstalled ? `Detected (${openClawVersion || 'Unknown Ver'})` : 'Not Detected'}
                                </span>
                            </div>

                            {!openClawInstalled ? (
                                <div style={{
                                    padding: 20,
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', fontWeight: 600 }}>
                                        <span className="codicon codicon-warning" style={{ fontSize: 18 }} />
                                        <span>OpenClaw CLI Not Installed or Out of PATH</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        OpenClaw was not found on your system. To use this integration, please make sure you have 
                                        <strong> Node.js 22.19+</strong> and install the CLI globally on your machine:
                                    </div>
                                    <div style={{
                                        background: 'var(--bg-input)',
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        color: 'var(--accent-primary)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span>npm install -g openclaw</span>
                                        <span 
                                            className="codicon codicon-copy" 
                                            style={{ cursor: 'pointer', opacity: 0.7 }}
                                            onClick={() => navigator.clipboard.writeText('npm install -g openclaw')}
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const installed = await getIpc().invoke('openclaw:check-installed');
                                            setOpenClawInstalled(installed);
                                        }}
                                        style={{
                                            alignSelf: 'flex-start',
                                            padding: '6px 14px',
                                            background: 'var(--bg-active)',
                                            border: '1px solid var(--border-subtle)',
                                            color: 'var(--text-primary)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12
                                        }}
                                    >
                                        <span className="codicon codicon-refresh" /> Refresh Checks
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {/* Grid layout for daemon status and pairing */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        
                                        {/* Daemon Controller Card */}
                                        <div style={{
                                            padding: 16,
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            gap: 12
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="codicon codicon-server" />
                                                    <span>OpenClaw Control Plane</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                                    <span style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: openClawIsRunning ? '#10b981' : '#6b7280',
                                                        boxShadow: openClawIsRunning ? '0 0 8px #10b981' : 'none',
                                                        display: 'inline-block'
                                                    }} />
                                                    <span style={{ fontSize: 12, fontWeight: 500, color: openClawIsRunning ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                        {openClawIsRunning ? `Running on port ${openClawPort}` : 'Gateway Stopped'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                                <button
                                                    onClick={async () => {
                                                        if (openClawIsRunning) {
                                                            await getIpc().invoke('openclaw:stop-gateway');
                                                        } else {
                                                            await getIpc().invoke('openclaw:start-gateway', { port: openClawPort });
                                                        }
                                                        const status = await getIpc().invoke('openclaw:get-status');
                                                        setOpenClawIsRunning(status.isRunning);
                                                        setOpenClawLogs(status.logs || []);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        background: openClawIsRunning ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-primary)',
                                                        border: openClawIsRunning ? '1px solid #ef4444' : 'none',
                                                        color: openClawIsRunning ? '#ef4444' : '#fff',
                                                        borderRadius: 'var(--radius-md)',
                                                        cursor: 'pointer',
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 6
                                                    }}
                                                >
                                                    <span className={`codicon codicon-${openClawIsRunning ? 'stop-circle' : 'play'}`} />
                                                    <span>{openClawIsRunning ? 'Stop Gateway' : 'Start Gateway'}</span>
                                                </button>
                                                
                                                <div style={{ width: 80 }}>
                                                    <input
                                                        type="number"
                                                        value={openClawPort}
                                                        disabled={openClawIsRunning}
                                                        onChange={e => setOpenClawPort(Number(e.target.value))}
                                                        style={{
                                                            width: '100%',
                                                            padding: '7px 8px',
                                                            background: 'var(--bg-input)',
                                                            border: '1px solid var(--border-subtle)',
                                                            color: 'var(--text-primary)',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontSize: 12,
                                                            outline: 'none',
                                                            textAlign: 'center',
                                                            opacity: openClawIsRunning ? 0.6 : 1
                                                        }}
                                                        placeholder="Port"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pairing Approver Card */}
                                        <div style={{
                                            padding: 16,
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 8
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="codicon codicon-link" />
                                                <span>Channel Link Pairing</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                <select
                                                    value={pairingChannel}
                                                    onChange={e => setPairingChannel(e.target.value)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '4px 8px',
                                                        background: 'var(--bg-input)',
                                                        border: '1px solid var(--border-subtle)',
                                                        color: 'var(--text-primary)',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontSize: 11
                                                    }}
                                                >
                                                    <option value="whatsapp">WhatsApp</option>
                                                    <option value="telegram">Telegram</option>
                                                    <option value="slack">Slack</option>
                                                    <option value="discord">Discord</option>
                                                    <option value="signal">Signal</option>
                                                    <option value="imessage">iMessage</option>
                                                    <option value="teams">Microsoft Teams</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={pairingCode}
                                                    onChange={e => setPairingCode(e.target.value)}
                                                    placeholder="Pairing Code (e.g. 123-456)"
                                                    style={{
                                                        flex: 1.5,
                                                        padding: '4px 8px',
                                                        background: 'var(--bg-input)',
                                                        border: '1px solid var(--border-subtle)',
                                                        color: 'var(--text-primary)',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontSize: 11,
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!pairingCode.trim()) return;
                                                    setIsPairingRunning(true);
                                                    setPairingStatus({ type: 'idle', message: '' });
                                                    try {
                                                        const success = await getIpc().invoke('openclaw:approve-pairing', pairingChannel, pairingCode.trim());
                                                        if (success) {
                                                            setPairingStatus({ type: 'success', message: 'Pairing approved successfully!' });
                                                            setPairingCode('');
                                                        } else {
                                                            setPairingStatus({ type: 'error', message: 'Failed to approve pairing code.' });
                                                        }
                                                    } catch (e: any) {
                                                        setPairingStatus({ type: 'error', message: e.message || 'Error occurred.' });
                                                    }
                                                    setIsPairingRunning(false);
                                                }}
                                                disabled={isPairingRunning || !pairingCode.trim()}
                                                style={{
                                                    padding: '6px 12px',
                                                    background: 'var(--bg-active)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: pairingCode.trim() ? 'pointer' : 'not-allowed',
                                                    fontSize: 11,
                                                    fontWeight: 500,
                                                    opacity: pairingCode.trim() ? 1 : 0.5,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 6
                                                }}
                                            >
                                                {isPairingRunning ? (
                                                    <span className="codicon codicon-loading codicon-modifier-spin" />
                                                ) : (
                                                    <span className="codicon codicon-check-all" />
                                                )}
                                                <span>Approve Pairing</span>
                                            </button>
                                            {pairingStatus.message && (
                                                <div style={{
                                                    fontSize: 10,
                                                    color: pairingStatus.type === 'success' ? '#10b981' : '#ef4444',
                                                    marginTop: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <span className={`codicon codicon-${pairingStatus.type === 'success' ? 'pass-filled' : 'error'}`} />
                                                    <span>{pairingStatus.message}</span>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    {/* Diagnostics / Doctor Console */}
                                    <div style={{
                                        padding: 16,
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className="codicon codicon-beaker" />
                                                <span>Environment Diagnostics</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setDoctorRunning(true);
                                                    setDoctorLogs('Running openclaw doctor...');
                                                    const out = await getIpc().invoke('openclaw:run-doctor');
                                                    setDoctorLogs(out);
                                                    setDoctorRunning(false);
                                                }}
                                                disabled={doctorRunning}
                                                style={{
                                                    padding: '4px 10px',
                                                    background: 'var(--bg-active)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    fontSize: 11,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}
                                            >
                                                {doctorRunning ? (
                                                    <span className="codicon codicon-loading codicon-modifier-spin" />
                                                ) : (
                                                    <span className="codicon codicon-play" />
                                                )}
                                                <span>Run Doctor</span>
                                            </button>
                                        </div>
                                        
                                        {doctorLogs && (
                                            <pre style={{
                                                margin: 0,
                                                background: 'var(--bg-input)',
                                                border: '1px solid var(--border-subtle)',
                                                padding: '10px 12px',
                                                borderRadius: 'var(--radius-md)',
                                                maxHeight: 120,
                                                overflowY: 'auto',
                                                fontFamily: 'monospace',
                                                fontSize: 11,
                                                color: 'var(--text-secondary)',
                                                lineHeight: 1.4,
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {doctorLogs}
                                            </pre>
                                        )}
                                    </div>

                                    {/* Recent Live Gateway Logs Console */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="codicon codicon-terminal" />
                                            <span>Recent Gateway Logs</span>
                                        </div>
                                        <div style={{
                                            background: '#0c0d12',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 12,
                                            height: 140,
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                            fontFamily: 'monospace',
                                            fontSize: 11,
                                            color: '#a9b1d6',
                                            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)'
                                        }}>
                                            {openClawLogs.length === 0 ? (
                                                <div style={{ color: '#565f89', fontStyle: 'italic', padding: '10px 0' }}>
                                                    No gateway logs recorded yet. Start the gateway to see operational details.
                                                </div>
                                            ) : (
                                                openClawLogs.map((log, idx) => (
                                                    <div key={idx} style={{
                                                        whiteSpace: 'pre-wrap',
                                                        lineHeight: 1.4,
                                                        color: log.includes('ERR') || log.includes('Error') ? '#f7768e' :
                                                               log.includes('WRN') || log.includes('Warning') ? '#e0af68' :
                                                               log.includes('STDOUT') ? '#9ece6a' : '#a9b1d6'
                                                    }}>
                                                        {log}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{
                    position: 'absolute',
                    bottom: 0, right: 0, left: 200,
                    padding: '16px 30px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 12,
                    background: 'var(--bg-secondary)'
                }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                    >Cancel</button>
                    <button
                        onClick={handleSave}
                        style={{ padding: '6px 16px', background: 'var(--accent-primary)', border: 'none', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                    >Save Changes</button>
                </div>

            </div>
        </div>
    );
}
