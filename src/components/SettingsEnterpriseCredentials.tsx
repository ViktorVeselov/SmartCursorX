interface SettingsEnterpriseCredentialsProps {
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
    azureApiKey: string;
    setAzureApiKey: (v: string) => void;
    azureApiBase: string;
    setAzureApiBase: (v: string) => void;
    azureApiVersion: string;
    setAzureApiVersion: (v: string) => void;
}

export function SettingsEnterpriseCredentials(props: SettingsEnterpriseCredentialsProps) {
    const {
        awsAccessKeyId, setAwsAccessKeyId,
        awsSecretAccessKey, setAwsSecretAccessKey,
        awsRegion, setAwsRegion,
        vertexProject, setVertexProject,
        vertexLocation, setVertexLocation,
        azureApiKey, setAzureApiKey,
        azureApiBase, setAzureApiBase,
        azureApiVersion, setAzureApiVersion,
    } = props;

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="codicon codicon-cloud" style={{ color: 'var(--accent-primary)' }} />
                Enterprise Cloud Credentials
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Connect to enterprise model providers. Only fill in the ones you use — these are passed to LiteLLM or custom providers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* AWS Bedrock */}
                <div style={{ padding: 10, background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Amazon Bedrock</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>For Claude, Llama, Mistral via AWS</div>
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
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Google Vertex AI</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>For Gemini models via Google Cloud</div>
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
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Azure OpenAI</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6 }}>For GPT models via Microsoft Azure</div>
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
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="codicon codicon-lock" style={{ fontSize: 10 }} />
                API keys are encrypted at the OS level (DPAPI/Keychain) and never stored in plaintext.
            </div>
        </div>
    );
}
