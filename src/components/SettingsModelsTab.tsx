import { SettingsCustomGateways } from './SettingsCustomGateways';
import { SettingsEnterpriseCredentials } from './SettingsEnterpriseCredentials';
import { SettingsLiteLLMConfig } from './SettingsLiteLLMConfig';
import { SettingsModelRegistration } from './SettingsModelRegistration';
import { SettingsAvailableModels } from './SettingsAvailableModels';
import { SettingsFineTunedModels } from './SettingsFineTunedModels';


interface SettingsModelsTabProps {
    modelProvider: string;
    setModelProvider: (v: string) => void;
    selectedModel: string;
    setSelectedModel: (v: string) => void;
    availableModels: string[];
    setAvailableModels: (v: string[]) => void;
    zenModelInfo: { id: string; isFree: boolean }[];
    openAIKey: string;
    setOpenAIKey: (v: string) => void;
    anthropicKey: string;
    setAnthropicKey: (v: string) => void;
    geminiKey: string;
    setGeminiKey: (v: string) => void;
    openrouterKey: string;
    setOpenrouterKey: (v: string) => void;
    liteLLMKey: string;
    setLiteLLMKey: (v: string) => void;
    customApiKey: string;
    setCustomApiKey: (v: string) => void;
    customProviderIsLocal: boolean;
    setCustomProviderIsLocal: (v: boolean) => void;
    showAddCustomProvider: boolean;
    setShowAddCustomProvider: (v: boolean) => void;
    customProviderId: string;
    setCustomProviderId: (v: string) => void;
    customProviderName: string;
    setCustomProviderName: (v: string) => void;
    customProviderBaseUrl: string;
    setCustomProviderBaseUrl: (v: string) => void;
    customProviderApiKey: string;
    setCustomProviderApiKey: (v: string) => void;
    customProviders: Record<string, unknown>[];
    setCustomProviders: (v: Record<string, unknown>[]) => void;
    newModelName: string;
    setNewModelName: (v: string) => void;
    customModelsList: Record<string, unknown>[];
    setCustomModelsList: (v: Record<string, unknown>[]) => void;
    modelSearchQuery: string;
    setModelSearchQuery: (v: string) => void;
    githubToken: string;
    setGithubToken: (v: string) => void;
    awsAccessKeyId: string;
    setAwsAccessKeyId: (v: string) => void;
    awsSecretAccessKey: string;
    setAwsSecretAccessKey: (v: string) => void;
    awsRegion: string;
    setAwsRegion: (v: string) => void;
    vertexProject: string;
    setVertexProject: (v: string) => void;
    vertexLocation: string;
    setVertexLocation: (v: string) => void;
    vertexApiKey: string;
    setVertexApiKey: (v: string) => void;
    isProxyRunning: boolean;
    setIsProxyRunning: (v: boolean) => void;
    azureApiKey: string;
    setAzureApiKey: (v: string) => void;
    azureApiBase: string;
    setAzureApiBase: (v: string) => void;
    azureApiVersion: string;
    setAzureApiVersion: (v: string) => void;
    enableLiteLLMProxy: boolean;
    setEnableLiteLLMProxy: (v: boolean) => void;
    liteLLMConfigPath: string;
    setLiteLLMConfigPath: (v: string) => void;
    liteLLMModel: string;
    setLiteLLMModel: (v: string) => void;
    liteLLMPort: number;
    setLiteLLMPort: (v: number) => void;
    fineTunedModels: any[];
    setFineTunedModels: (v: any[]) => void;
}

export function SettingsModelsTab(props: SettingsModelsTabProps) {
    const {
        modelProvider, setModelProvider,
        selectedModel, setSelectedModel,
        availableModels, setAvailableModels,
        zenModelInfo,
        openAIKey, setOpenAIKey,
        anthropicKey, setAnthropicKey,
        geminiKey, setGeminiKey,
        openrouterKey, setOpenrouterKey,
        liteLLMKey, setLiteLLMKey,
        customApiKey, setCustomApiKey,
        customProviderIsLocal, setCustomProviderIsLocal,
        showAddCustomProvider, setShowAddCustomProvider,
        customProviderId, setCustomProviderId,
        customProviderName, setCustomProviderName,
        customProviderBaseUrl, setCustomProviderBaseUrl,
        customProviderApiKey, setCustomProviderApiKey,
        customProviders, setCustomProviders,
        customModelsList, setCustomModelsList,
        modelSearchQuery, setModelSearchQuery,
        githubToken, setGithubToken,
        awsAccessKeyId, setAwsAccessKeyId,
        awsSecretAccessKey, setAwsSecretAccessKey,
        awsRegion, setAwsRegion,
        vertexProject, setVertexProject,
        vertexLocation, setVertexLocation,
        azureApiKey, setAzureApiKey,
        azureApiBase, setAzureApiBase,
        azureApiVersion, setAzureApiVersion,
        enableLiteLLMProxy, setEnableLiteLLMProxy,
        liteLLMConfigPath, setLiteLLMConfigPath,
        liteLLMModel, setLiteLLMModel,
        liteLLMPort, setLiteLLMPort,
        isProxyRunning,
        fineTunedModels, setFineTunedModels,
    } = props;

    return (
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
                                <option value="gemini">Google Gemini (Official)</option>
                                <option value="openrouter">OpenRouter (Free Models)</option>
                                <option value="litellm">LiteLLM (Local Proxy)</option>
                                <option value="ollama">Ollama (Local)</option>
                                <option value="local">Local Models (Experimental)</option>
                                <option value="zen">OpenCode Zen — Free Models</option>
                                {customProviders.length > 0 && (
                                    <option disabled style={{ color: 'var(--text-secondary)', fontSize: 10 }}>───────────────────</option>
                                )}
                                {customProviders.map((p: Record<string, unknown>) => {
                                    const id = p.id as string;
                                    const name = p.name as string;
                                    return <option key={id} value={id}>{name}</option>;
                                })}
                            </select>
                        </div>

                        <div style={{ flex: 1.2 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>Selected Model</label>
                            <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12 }}
                            >
                                {availableModels.map(m => {
                                    const info = zenModelInfo.find(z => z.id === m);
                                    const displayNames: Record<string, string> = {
                                        'deepseek-v4-flash-free': 'DeepSeek V4 Flash Free (Medium)',
                                        'deepseek-v4-flash-free-low': 'DeepSeek V4 Flash Free (Low Effort)',
                                        'deepseek-v4-flash-free-high': 'DeepSeek V4 Flash Free (High Effort)',
                                        'mimo-v2.5-free': 'MiMo V2.5 Free',
                                        'north-mini-code-free': 'North Mini Code Free',
                                        'nemotron-3-ultra-free': 'Nemotron 3 Ultra Free',
                                        'big-pickle': 'Big Pickle',
                                        'qwen3.6-plus-free': 'Qwen 3.6 Plus Free',
                                        'minimax-m3-free': 'MiniMax M3 Free',
                                    };
                                    const displayName = modelProvider === 'zen' ? (displayNames[m] || m) : m;
                                    const label = info?.isFree ? `${displayName} (FREE)` : displayName;
                                    return <option key={m} value={m}>{label}</option>;
                                })}
                            </select>
                        </div>
                    </div>

                    {/* Unified Dynamic API Key Configuration */}
                    {modelProvider !== 'ollama' && modelProvider !== 'zen' && modelProvider !== 'local' && (
                        <div style={{ marginBottom: 0 }}>
                            <label style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                API Key
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="password"
                                    value={
                                        modelProvider === 'openai'
                                            ? openAIKey
                                            : modelProvider === 'anthropic'
                                            ? anthropicKey
                                            : modelProvider === 'gemini'
                                            ? geminiKey
                                            : modelProvider === 'openrouter'
                                            ? openrouterKey
                                            : modelProvider === 'litellm'
                                            ? liteLLMKey
                                            : customApiKey
                                    }
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (modelProvider === 'openai') setOpenAIKey(val);
                                        else if (modelProvider === 'anthropic') setAnthropicKey(val);
                                        else if (modelProvider === 'gemini') setGeminiKey(val);
                                        else if (modelProvider === 'openrouter') setOpenrouterKey(val);
                                        else if (modelProvider === 'litellm') setLiteLLMKey(val);
                                        else setCustomApiKey(val);
                                    }}
                                    placeholder={
                                        modelProvider === 'openai'
                                            ? 'sk-...'
                                            : modelProvider === 'anthropic'
                                            ? 'sk-ant-...'
                                            : modelProvider === 'gemini'
                                            ? 'AIzaSy...'
                                            : modelProvider === 'openrouter'
                                            ? 'sk-or-v1-...'
                                            : modelProvider === 'litellm'
                                            ? 'Enter LiteLLM proxy API key (Optional)'
                                            : 'Enter API key or token if required'
                                    }
                                    style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12, boxSizing: 'border-box' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (modelProvider === 'openai') setOpenAIKey('');
                                        else if (modelProvider === 'anthropic') setAnthropicKey('');
                                        else if (modelProvider === 'gemini') setGeminiKey('');
                                        else if (modelProvider === 'openrouter') setOpenrouterKey('');
                                        else if (modelProvider === 'litellm') setLiteLLMKey('');
                                        else setCustomApiKey('');
                                    }}
                                    title="Delete / Clear API Key"
                                    style={{
                                        padding: '6px 10px',
                                        background: 'var(--bg-input)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                >
                                    <span className="codicon codicon-trash" style={{ fontSize: 13 }} />
                                </button>
                            </div>
                            
                            {customProviders.some((p: Record<string, unknown>) => p.id === modelProvider) && (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input
                                        type="checkbox"
                                        id="custom-provider-local-check"
                                        checked={customProviderIsLocal}
                                        onChange={e => setCustomProviderIsLocal(e.target.checked)}
                                    />
                                    <label htmlFor="custom-provider-local-check" style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        Local Provider?
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Zen Free Models Info Banner */}
                    {modelProvider === 'zen' && (
                        <div style={{
                            marginTop: 12,
                            padding: '10px 12px',
                            background: 'rgba(34, 197, 94, 0.08)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            lineHeight: '1.4'
                        }}>
                            <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="codicon codicon-check" style={{ fontSize: 12 }} />
                                No API Key Needed
                            </div>
                            <div style={{ marginBottom: 4 }}>
                                Free models cost nothing and need no signup. Free models are available for a limited time and data may be used to improve them.
                            </div>
                        </div>
                    )}

                    {/* OpenRouter Free Models Info Banner */}
                    {modelProvider === 'openrouter' && (
                        <div style={{
                            marginTop: 12,
                            padding: '10px 12px',
                            background: 'rgba(34, 197, 94, 0.08)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            lineHeight: '1.4'
                        }}>
                            <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="codicon codicon-key" style={{ fontSize: 12 }} />
                                API Key Required (Free Models Available)
                            </div>
                            <div style={{ marginBottom: 4 }}>
                                OpenRouter requires an API key, but offers 20+ free models. Get a free API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>openrouter.ai/keys</a>. Use the special model <strong>openrouter/free</strong> to auto-route to available free models.
                            </div>
                        </div>
                    )}

                    {/* Explanatory Info Box for connecting to any provider */}
                    <div style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        lineHeight: '1.4'
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="codicon codicon-info" style={{ color: 'var(--accent-primary)', fontSize: 12 }} />
                            How to Connect Any Provider:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 14 }}>
                            <li><strong>Standard Providers</strong>: Connect directly to OpenAI, Anthropic, or local Ollama.</li>
                            <li><strong>OpenCode Zen</strong>: Free coding models — no API key or signup required.</li>
                            <li><strong>LiteLLM Local Proxy</strong>: Runs a local unified endpoint (`http://localhost:4000/v1`) to manage multiple cloud/local models.</li>
                            <li><strong>Custom API Gateways</strong>: Connect directly to any other OpenAI-compatible host (e.g. OpenRouter, DeepSeek, Together, Groq) without needing a local proxy connection.</li>
                        </ul>
                    </div>
                </div>

                <SettingsCustomGateways
                    showAddCustomProvider={showAddCustomProvider} setShowAddCustomProvider={setShowAddCustomProvider}
                    customProviderId={customProviderId} setCustomProviderId={setCustomProviderId}
                    customProviderName={customProviderName} setCustomProviderName={setCustomProviderName}
                    customProviderBaseUrl={customProviderBaseUrl} setCustomProviderBaseUrl={setCustomProviderBaseUrl}
                    customProviderApiKey={customProviderApiKey} setCustomProviderApiKey={setCustomProviderApiKey}
                    customProviderIsLocal={customProviderIsLocal} setCustomProviderIsLocal={setCustomProviderIsLocal}
                    customProviders={customProviders} setCustomProviders={setCustomProviders}
                    modelProvider={modelProvider} setModelProvider={setModelProvider}
                />

                <SettingsEnterpriseCredentials
                    awsAccessKeyId={awsAccessKeyId} setAwsAccessKeyId={setAwsAccessKeyId}
                    awsSecretAccessKey={awsSecretAccessKey} setAwsSecretAccessKey={setAwsSecretAccessKey}
                    awsRegion={awsRegion} setAwsRegion={setAwsRegion}
                    vertexProject={vertexProject} setVertexProject={setVertexProject}
                    vertexLocation={vertexLocation} setVertexLocation={setVertexLocation}
                    azureApiKey={azureApiKey} setAzureApiKey={setAzureApiKey}
                    azureApiBase={azureApiBase} setAzureApiBase={setAzureApiBase}
                    azureApiVersion={azureApiVersion} setAzureApiVersion={setAzureApiVersion}
                />

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
                {modelProvider === 'local' ? (
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
                        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="codicon codicon-info" style={{ color: 'var(--accent-primary)' }} />
                            Local Models Config
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                            To download, manage, start, or stop local GGUF models, please use the dedicated <strong>Local LLMs</strong> tab in the settings sidebar.
                        </p>
                    </div>
                ) : (
                    <>
                        <SettingsLiteLLMConfig
                            enableLiteLLMProxy={enableLiteLLMProxy} setEnableLiteLLMProxy={setEnableLiteLLMProxy}
                            liteLLMConfigPath={liteLLMConfigPath} setLiteLLMConfigPath={setLiteLLMConfigPath}
                            liteLLMModel={liteLLMModel} setLiteLLMModel={setLiteLLMModel}
                            liteLLMPort={liteLLMPort} setLiteLLMPort={setLiteLLMPort}
                            isProxyRunning={isProxyRunning}
                        />

                        <SettingsModelRegistration
                            modelProvider={modelProvider}
                            setModelProvider={setModelProvider}
                            setAvailableModels={setAvailableModels}
                            customModelsList={customModelsList} setCustomModelsList={setCustomModelsList}
                        />

                        <SettingsAvailableModels
                            availableModels={availableModels}
                            modelSearchQuery={modelSearchQuery} setModelSearchQuery={setModelSearchQuery}
                            modelProvider={modelProvider}
                            customModelsList={customModelsList} setCustomModelsList={setCustomModelsList}
                            setAvailableModels={setAvailableModels}
                        />

                        <SettingsFineTunedModels
                            fineTunedModels={fineTunedModels} setFineTunedModels={setFineTunedModels}
                            modelProvider={modelProvider} setModelProvider={setModelProvider}
                            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
