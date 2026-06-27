import { useState, useEffect } from 'react';
import { AgentRule } from './SettingsRulesTab';
import { SettingsGeneralTab } from './SettingsGeneralTab';
import { SettingsModelsTab } from './SettingsModelsTab';
import { SettingsAgentTab } from './SettingsAgentTab';
import { SettingsRulesTab } from './SettingsRulesTab';
import { SettingsOpenClawTab } from './SettingsOpenClawTab';
import { SettingsUsageTab } from './SettingsUsageTab';
import { SettingsPerformanceTab } from './SettingsPerformanceTab';
import { SettingsFinetuningTab } from './SettingsFinetuningTab';
import { SettingsLocalModels } from './SettingsLocalModels';
import { SettingsEmbeddingTab } from './SettingsEmbeddingTab';
import { SettingsPipelineTab } from './SettingsPipelineTab';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTab = 'general' | 'models' | 'embeddings' | 'pipeline' | 'agent' | 'rules' | 'openclaw' | 'local' | 'usage' | 'performance' | 'finetuning';

const getIpc = () => window.ipcRenderer;

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [expanded, setExpanded] = useState(false);

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
    const [geminiKey, setGeminiKey] = useState('');
    const [openrouterKey, setOpenrouterKey] = useState('');
    const [liteLLMKey, setLiteLLMKey] = useState('');
    const [githubToken, setGithubToken] = useState('');
    const [huggingfaceToken, setHuggingfaceToken] = useState('');

    // Dynamic models selection inside Settings
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState('gpt-4o');

    // Zen model info (free vs paid)
    const [zenModelInfo, setZenModelInfo] = useState<{ id: string; isFree: boolean }[]>([]);

    // Dynamic Custom Providers & Models States
    const [customProviders, setCustomProviders] = useState<Record<string, unknown>[]>([]);
    const [customApiKey, setCustomApiKey] = useState('');
    const [showAddCustomProvider, setShowAddCustomProvider] = useState(false);
    const [customProviderId, setCustomProviderId] = useState('');
    const [customProviderName, setCustomProviderName] = useState('');
    const [customProviderBaseUrl, setCustomProviderBaseUrl] = useState('');
    const [customProviderApiKey, setCustomProviderApiKey] = useState('');
    const [customProviderIsLocal, setCustomProviderIsLocal] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [customModelsList, setCustomModelsList] = useState<Record<string, unknown>[]>([]);
    const [modelSearchQuery, setModelSearchQuery] = useState('');

    // Usage Tracking states
    const [usageStats, setUsageStats] = useState<{ totalTokens: number, totalInputTokens: number, totalOutputTokens: number, totalCost: number, breakdowns: Record<string, unknown>[] }>({ totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, breakdowns: [] });

    // LiteLLM Local Proxy states
    const [enableLiteLLMProxy, setEnableLiteLLMProxy] = useState(false);
    const [liteLLMConfigPath, setLiteLLMConfigPath] = useState('');
    const [liteLLMModel, setLiteLLMModel] = useState('gpt-4o');
    const [liteLLMPort, setLiteLLMPort] = useState(4000);
    const [isProxyRunning, setIsProxyRunning] = useState(false);

    // Local LLMs Server States
    const [isLocalServerRunning, setIsLocalServerRunning] = useState(false);
    const [runningLocalModel, setRunningLocalModel] = useState<string | null>(null);

    // Fine-Tuned Models
    const [fineTunedModels, setFineTunedModels] = useState<any[]>([]);

    // Embedding Config
    const [embeddingProvider, setEmbeddingProvider] = useState('openai');
    const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
    const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState('');
    const [embeddingDimension, setEmbeddingDimension] = useState(0);

    // Enterprise Cloud Credentials
    const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
    const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
    const [awsRegion, setAwsRegion] = useState('us-east-1');
    const [vertexProject, setVertexProject] = useState('');
    const [vertexLocation, setVertexLocation] = useState('us-central1');
    const [vertexApiKey, setVertexApiKey] = useState('');
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

    // Agent Rules states
    const [rules, setRules] = useState<AgentRule[]>([]);
    const [editingRule, setEditingRule] = useState<AgentRule | null>(null);
    const [ruleName, setRuleName] = useState('');
    const [ruleContent, setRuleContent] = useState('');
    const [isRuleActive, setIsRuleActive] = useState(true);

    const loadRules = async () => {
        try {
            const list = await getIpc().invoke('db:get-rules');
            setRules(list || []);
        } catch (e) {
            console.error('Failed to load rules:', e);
        }
    };

    // Load initial settings securely
    useEffect(() => {
        // eslint-disable-next-line complexity
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

                setEmbeddingProvider(settings.embeddingProvider || settings.activeProvider || 'openai');
                setEmbeddingModel(settings.embeddingModel || (settings.embeddingProvider === 'openrouter' ? 'openai/text-embedding-3-small' : 'text-embedding-3-small'));
                setEmbeddingBaseUrl(settings.embeddingBaseUrl || '');
                setEmbeddingDimension(settings.embeddingDimension || 0);
            }

            // Fetch stored encrypted keys
            const oKey = await getIpc().invoke('ai:get-provider-key', 'openai');
            if (oKey) setOpenAIKey(oKey);

            const aKey = await getIpc().invoke('ai:get-provider-key', 'anthropic');
            if (aKey) setAnthropicKey(aKey);

            const gKey = await getIpc().invoke('ai:get-provider-key', 'gemini');
            if (gKey) setGeminiKey(gKey);

            const orKey = await getIpc().invoke('ai:get-provider-key', 'openrouter');
            if (orKey) setOpenrouterKey(orKey);

            const lKey = await getIpc().invoke('ai:get-provider-key', 'litellm');
            if (lKey) setLiteLLMKey(lKey);

            const gh = await getIpc().invoke('get-github-token');
            if (gh) setGithubToken(gh);

            const hf = await getIpc().invoke('get-huggingface-token');
            if (hf) setHuggingfaceToken(hf);

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

            // Local server status is now handled by a separate polling useEffect

            // Load rules
            await loadRules();
        };
        loadSettings();
    }, [isOpen]);

    // Poll local server status dynamically while settings is open
    useEffect(() => {
        if (!isOpen) return;
        const checkStatus = async () => {
            try {
                const localStatus = await getIpc().invoke('local:server-status');
                if (localStatus) {
                    setIsLocalServerRunning(localStatus.running);
                    setRunningLocalModel(localStatus.model);
                }
            } catch (e) {
                console.error('Failed to get local server status in settings modal:', e);
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
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

    // Usage Metrics Loader
    useEffect(() => {
        if (!isOpen) return;
        
        const fetchUsage = async () => {
            const stats = await getIpc().invoke('ai:get-usage-stats');
            if (stats) setUsageStats(stats);
        };

        if (activeTab === 'usage') {
            fetchUsage();
            // Poll for updates every 3 seconds to keep it live
            const interval = setInterval(fetchUsage, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen, activeTab]);

    // Load dynamic models list and provider specifics when provider or customProviders change
    useEffect(() => {
        // eslint-disable-next-line complexity
        const fetchProviderDetails = async () => {
            // Fetch Zen model info first so we can sort free models to the top
            let info: { id: string; isFree: boolean }[] = [];
            if (modelProvider === 'zen') {
                info = await getIpc().invoke('ai:get-zen-models-info') || [];
                setZenModelInfo(info);
            } else {
                setZenModelInfo([]);
            }

            const list = await getIpc().invoke('ai:get-models', modelProvider);
            console.assert(Array.isArray(list), 'Fetched models list must be an array');

            // Sort: free models first when Zen is selected
            const sorted = list && modelProvider === 'zen' && info.length > 0
                ? [...list].sort((a, b) => {
                    const aFree = info.find(z => z.id === a)?.isFree ?? false;
                    const bFree = info.find(z => z.id === b)?.isFree ?? false;
                    if (aFree !== bFree) return aFree ? -1 : 1;
                    return a.localeCompare(b);
                })
                : list;
            setAvailableModels(sorted || []);
            // Default to first free model if available, otherwise first model
            if (sorted && sorted.length > 0) {
                if (!sorted.includes(selectedModel)) {
                    const firstFree = modelProvider === 'zen' ? sorted.find((m: string) => info.find((z: Record<string, unknown>) => z.id === m)?.isFree) : undefined;
                    setSelectedModel(firstFree || sorted[0]);
                }
            }

            // Fetch custom models from DB
            const dbModels = await getIpc().invoke('ai:get-custom-models', modelProvider);
            setCustomModelsList(dbModels || []);

            // Load custom API key if custom provider
            const custom = customProviders.find((p: Record<string, unknown>) => p.id === modelProvider);
            if (custom) {
                const key = await getIpc().invoke('ai:get-provider-key', modelProvider);
                setCustomApiKey(key || custom.api_key || '');
            } else {
                setCustomApiKey('');
            }
        };
        fetchProviderDetails();
    }, [modelProvider, customProviders, selectedModel]);

    // eslint-disable-next-line complexity
    const handleSave = async () => {
        // Save all keys so changes across multiple providers are preserved on Save Changes
        await getIpc().invoke('set-api-key', openAIKey);
        await getIpc().invoke('ai:save-provider-key', { providerId: 'anthropic', apiKey: anthropicKey });
        await getIpc().invoke('ai:save-provider-key', { providerId: 'gemini', apiKey: geminiKey });
        if (openrouterKey && !openrouterKey.startsWith('sk-or-v1-')) {
            alert('OpenRouter API key must start with "sk-or-v1-". Check your key at https://openrouter.ai/keys');
            return;
        }
        await getIpc().invoke('ai:save-provider-key', { providerId: 'openrouter', apiKey: openrouterKey });
        await getIpc().invoke('ai:save-provider-key', { providerId: 'litellm', apiKey: liteLLMKey });
        if (customProviders.some(p => p.id === modelProvider)) {
            await getIpc().invoke('ai:save-provider-key', { providerId: modelProvider, apiKey: customApiKey });
        }

        await getIpc().invoke('set-github-token', githubToken);
        await getIpc().invoke('set-huggingface-token', huggingfaceToken);

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
            apiKey: modelProvider === 'openai' ? openAIKey : modelProvider === 'anthropic' ? anthropicKey : modelProvider === 'gemini' ? geminiKey : modelProvider === 'openrouter' ? openrouterKey : modelProvider === 'litellm' ? liteLLMKey : modelProvider === 'ollama' || modelProvider === 'zen' || modelProvider === 'local' ? '' : customApiKey
        });

        // Save general & agent configuration (including cloud settings)
        const generalSettings: Record<string, any> = {
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
            azureApiVersion,

            embeddingProvider,
            embeddingModel,
            embeddingBaseUrl,
        };
        if (embeddingDimension > 0) {
            generalSettings.embeddingDimension = embeddingDimension;
        }
        await getIpc().invoke('save-general-settings', generalSettings);

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

    if (!isOpen) return null;

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
                width: expanded ? 1200 : 900,
                height: expanded ? 800 : 540,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
                transition: 'width 0.2s ease, height 0.2s ease',
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
                        const baseTabs = ['general', 'models', 'embeddings', 'pipeline', 'agent', 'rules', 'openclaw', 'usage', 'performance', 'finetuning', 'local'];
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
                                    fontSize: 13,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <span className={`codicon codicon-${tab === 'general' ? 'gear' : tab === 'models' ? 'circuit-board' : tab === 'embeddings' ? 'database' : tab === 'pipeline' ? 'debug-step-over' : tab === 'agent' ? 'hubot' : tab === 'rules' ? 'checklist' : tab === 'openclaw' ? 'server-process' : tab === 'local' ? 'server-environment' : tab === 'usage' ? 'graph-line' : tab === 'performance' ? 'dashboard' : tab === 'finetuning' ? 'wand' : 'gear'}`} style={{ fontSize: 14 }} />
                                <span style={{ flex: 1, textAlign: 'left' }}>
                                    {tab === 'openclaw' ? 'OpenClaw' : tab === 'local' ? 'Local LLMs (Exp)' : tab === 'usage' ? 'Usage & Costs' : tab === 'performance' ? 'Performance' : tab === 'finetuning' ? 'Fine-Tune (Exp)' : tab === 'rules' ? 'Rules' : tab === 'embeddings' ? 'Embeddings' : tab === 'pipeline' ? 'Pipeline' : tab}
                                </span>
                                {tab === 'local' && isLocalServerRunning && (
                                    <span style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: '#22c55e',
                                        boxShadow: '0 0 8px #22c55e',
                                        display: 'inline-block',
                                        marginLeft: 6
                                    }} title={`Local model running: ${runningLocalModel || ''}`} />
                                )}
                            </div>
                        ));
                    })()}
                </div>

                {/* Expand/Collapse toggle */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    title={expanded ? 'Collapse' : 'Expand'}
                    style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 14,
                        zIndex: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                    <span className={`codicon codicon-${expanded ? 'screen-normal' : 'screen-full'}`} />
                </button>

                {/* Content */}
                <div style={{ flex: 1, padding: 30, overflowY: 'auto', paddingBottom: 80 }}>
                    {activeTab === 'general' && (
                        <SettingsGeneralTab theme={theme} setTheme={setTheme} fontSize={fontSize} setFontSize={setFontSize} />
                    )}

                    {activeTab === 'models' && (
                        <SettingsModelsTab
                            modelProvider={modelProvider} setModelProvider={setModelProvider}
                            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
                            availableModels={availableModels} setAvailableModels={setAvailableModels}
                            zenModelInfo={zenModelInfo}
                            openAIKey={openAIKey} setOpenAIKey={setOpenAIKey}
                            anthropicKey={anthropicKey} setAnthropicKey={setAnthropicKey}
                            geminiKey={geminiKey} setGeminiKey={setGeminiKey}
                            openrouterKey={openrouterKey} setOpenrouterKey={setOpenrouterKey}
                            liteLLMKey={liteLLMKey} setLiteLLMKey={setLiteLLMKey}
                            customApiKey={customApiKey} setCustomApiKey={setCustomApiKey}
                            customProviderIsLocal={customProviderIsLocal} setCustomProviderIsLocal={setCustomProviderIsLocal}
                            showAddCustomProvider={showAddCustomProvider} setShowAddCustomProvider={setShowAddCustomProvider}
                            customProviderId={customProviderId} setCustomProviderId={setCustomProviderId}
                            customProviderName={customProviderName} setCustomProviderName={setCustomProviderName}
                            customProviderBaseUrl={customProviderBaseUrl} setCustomProviderBaseUrl={setCustomProviderBaseUrl}
                            customProviderApiKey={customProviderApiKey} setCustomProviderApiKey={setCustomProviderApiKey}
                            customProviders={customProviders} setCustomProviders={setCustomProviders}
                            newModelName={newModelName} setNewModelName={setNewModelName}
                            customModelsList={customModelsList} setCustomModelsList={setCustomModelsList}
                            modelSearchQuery={modelSearchQuery} setModelSearchQuery={setModelSearchQuery}
                            githubToken={githubToken} setGithubToken={setGithubToken}
                            awsAccessKeyId={awsAccessKeyId} setAwsAccessKeyId={setAwsAccessKeyId}
                            awsSecretAccessKey={awsSecretAccessKey} setAwsSecretAccessKey={setAwsSecretAccessKey}
                            awsRegion={awsRegion} setAwsRegion={setAwsRegion}
                            vertexProject={vertexProject} setVertexProject={setVertexProject}
                            vertexLocation={vertexLocation} setVertexLocation={setVertexLocation}
                            vertexApiKey={vertexApiKey} setVertexApiKey={setVertexApiKey}
                            azureApiKey={azureApiKey} setAzureApiKey={setAzureApiKey}
                            azureApiBase={azureApiBase} setAzureApiBase={setAzureApiBase}
                            azureApiVersion={azureApiVersion} setAzureApiVersion={setAzureApiVersion}
                            enableLiteLLMProxy={enableLiteLLMProxy} setEnableLiteLLMProxy={setEnableLiteLLMProxy}
                            liteLLMConfigPath={liteLLMConfigPath} setLiteLLMConfigPath={setLiteLLMConfigPath}
                            liteLLMModel={liteLLMModel} setLiteLLMModel={setLiteLLMModel}
                            liteLLMPort={liteLLMPort} setLiteLLMPort={setLiteLLMPort}
                            isProxyRunning={isProxyRunning} setIsProxyRunning={setIsProxyRunning}
                            fineTunedModels={fineTunedModels} setFineTunedModels={setFineTunedModels}
                        />
                    )}

                    {activeTab === 'embeddings' && (
                        <SettingsEmbeddingTab
                            embeddingProvider={embeddingProvider} setEmbeddingProvider={setEmbeddingProvider}
                            embeddingModel={embeddingModel} setEmbeddingModel={setEmbeddingModel}
                            embeddingBaseUrl={embeddingBaseUrl} setEmbeddingBaseUrl={setEmbeddingBaseUrl}
                            embeddingDimension={embeddingDimension}
                        />
                    )}

                    {activeTab === 'pipeline' && (
                        <SettingsPipelineTab />
                    )}

                    {activeTab === 'agent' && (
                        <SettingsAgentTab
                            allowFileRead={allowFileRead} setAllowFileRead={setAllowFileRead}
                            autoApproveCommands={autoApproveCommands} setAutoApproveCommands={setAutoApproveCommands}
                            systemPromptOverride={systemPromptOverride} setSystemPromptOverride={setSystemPromptOverride}
                        />
                    )}

                    {activeTab === 'rules' && (
                        <SettingsRulesTab
                            rules={rules} editingRule={editingRule} setEditingRule={setEditingRule}
                            ruleName={ruleName} setRuleName={setRuleName}
                            ruleContent={ruleContent} setRuleContent={setRuleContent}
                            isRuleActive={isRuleActive} setIsRuleActive={setIsRuleActive}
                            loadRules={loadRules}
                        />
                    )}

                    {activeTab === 'openclaw' && (
                        <SettingsOpenClawTab
                            openClawInstalled={openClawInstalled} setOpenClawInstalled={setOpenClawInstalled}
                            openClawIsRunning={openClawIsRunning} setOpenClawIsRunning={setOpenClawIsRunning}
                            openClawVersion={openClawVersion}
                            openClawPort={openClawPort} setOpenClawPort={setOpenClawPort}
                            openClawLogs={openClawLogs} setOpenClawLogs={setOpenClawLogs}
                            doctorLogs={doctorLogs} setDoctorLogs={setDoctorLogs}
                            doctorRunning={doctorRunning} setDoctorRunning={setDoctorRunning}
                            pairingChannel={pairingChannel} setPairingChannel={setPairingChannel}
                            pairingCode={pairingCode} setPairingCode={setPairingCode}
                            pairingStatus={pairingStatus} setPairingStatus={setPairingStatus}
                            isPairingRunning={isPairingRunning} setIsPairingRunning={setIsPairingRunning}
                        />
                    )}

                    {activeTab === 'usage' && (
                        <SettingsUsageTab usageStats={usageStats} setUsageStats={setUsageStats} />
                    )}

                    {activeTab === 'performance' && (
                        <SettingsPerformanceTab />
                    )}

                    {activeTab === 'finetuning' && (
                        <SettingsFinetuningTab
                            huggingfaceToken={huggingfaceToken}
                            setHuggingfaceToken={setHuggingfaceToken}
                        />
                    )}

                    {activeTab === 'local' && (
                        <SettingsLocalModels />
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
