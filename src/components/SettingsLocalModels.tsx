import { useState, useEffect, useCallback, useRef } from 'react';

const getIpc = () => window.ipcRenderer;

interface LocalModelEntry {
  name: string;
  path: string;
  size: number;
}

interface HuggingFaceModel {
  id: string;
  repo: string;
  description: string;
  downloads: number;
  ggufFiles: string[];
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

const CTX_MIN = 512;
const CTX_MAX = 32768;
const CTX_STEP = 256;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function SettingsLocalModels() {
  const [models, setModels] = useState<LocalModelEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HuggingFaceModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [serverModel, setServerModel] = useState<string | null>(null);
  const [serverStarting, setServerStarting] = useState<string | null>(null);
  const [browsingRepos, setBrowsingRepos] = useState<Record<string, string[]>>({});
  const [browsingLoading, setBrowsingLoading] = useState<string | null>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [redownloading, setRedownloading] = useState(false);
  const [hfToken, setHfToken] = useState('');
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [modelContextSizes, setModelContextSizes] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadModels = useCallback(async () => {
    const list = await getIpc().invoke('local:list');
    setModels(list || []);
  }, []);

  const loadModelSettings = useCallback(async (modelNames: string[]) => {
    const sizes: Record<string, number> = {};
    for (const name of modelNames) {
      try {
        const settings = await getIpc().invoke('local:get-model-settings', 'local', name);
        if (settings && settings.context_size) {
          sizes[name] = settings.context_size;
        }
      } catch (e) {
        console.error('Failed to load settings for', name, e);
      }
    }
    setModelContextSizes(prev => ({ ...prev, ...sizes }));
  }, []);

  useEffect(() => {
    loadModels();
    const checkStatus = async () => {
      try {
        const status = await getIpc().invoke('local:server-status');
        if (status) {
          setServerRunning(status.running);
          setServerModel(status.model);
        }
      } catch (e) {
        console.error('Failed to get local server status:', e);
      }
    };
    checkStatus();
    getIpc().invoke('get-huggingface-token').then(t => { if (t) setHfToken(t); }).catch(() => {});
    const listener = (_event: any, progress: DownloadProgress) => {
      setDownloadProgress(progress);
    };
    getIpc().on('local:download-progress', listener);
    return () => { getIpc().off('local:download-progress', listener); };
  }, [loadModels]);

  useEffect(() => {
    if (models.length > 0) {
      loadModelSettings(models.map(m => m.name));
    }
  }, [models, loadModelSettings]);

  const saveContextSize = useCallback(async (modelName: string, ctx: number) => {
    try {
      await getIpc().invoke('local:set-context-size', modelName, ctx);
    } catch (e: any) {
      console.error('Failed to save context size:', e);
    }
  }, []);

  const handleContextSizeChange = (modelName: string, ctx: number) => {
    setModelContextSizes(prev => ({ ...prev, [modelName]: ctx }));
    if (debounceTimers.current[modelName]) {
      clearTimeout(debounceTimers.current[modelName]);
    }
    debounceTimers.current[modelName] = setTimeout(() => {
      saveContextSize(modelName, ctx);
    }, 500);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await getIpc().invoke('local:search-hf', searchQuery);
      setSearchResults(results || []);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (repo: string, filename: string) => {
    setDownloading(filename);
    setDownloadProgress(null);
    try {
      await getIpc().invoke('local:download', repo, filename);
      await loadModels();
    } catch (e: any) {
      alert('Download failed: ' + (e.message || e));
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    await getIpc().invoke('local:delete', name);
    await loadModels();
  };

  const handleStartServer = async (modelPath: string, modelName: string) => {
    setServerStarting(modelName);
    try {
      const ctx = modelContextSizes[modelName];
      await getIpc().invoke('local:start-server', modelPath, ctx || undefined);
      setServerRunning(true);
      setServerModel(modelName);

      const settings = await getIpc().invoke('get-general-settings');
      await getIpc().invoke('save-general-settings', {
        ...(settings || {}),
        activeProvider: 'local',
        selectedModel: modelName
      });
      await getIpc().invoke('ai:save-config', {
        providerId: 'local',
        apiKey: ''
      });
    } catch (e: any) {
      alert('Failed to start server: ' + (e.message || e));
    } finally {
      setServerStarting(null);
    }
  };

  const handleStopServer = async () => {
    await getIpc().invoke('local:stop-server');
    setServerRunning(false);
    setServerModel(null);
  };

  const handleBrowse = async (repo: string) => {
    if (browsingRepos[repo]?.length) return;
    setBrowsingLoading(repo);
    try {
      const files = await getIpc().invoke('local:hf-files', repo);
      setBrowsingRepos(prev => ({ ...prev, [repo]: files || [] }));
    } catch (e) {
      console.error('Failed to fetch files:', e);
      setBrowsingRepos(prev => ({ ...prev, [repo]: [] }));
    } finally {
      setBrowsingLoading(null);
    }
  };

  const handleRedownload = async () => {
    if (serverRunning) await handleStopServer();
    setRedownloading(true);
    try {
      await getIpc().invoke('local:redownload-llama');
      await loadModels();
    } catch (e: any) {
      console.error('Re-download failed:', e);
      alert('Re-download failed: ' + (e.message || e));
    } finally {
      setRedownloading(false);
    }
  };

  const handleSaveHfToken = async () => {
    try {
      await getIpc().invoke('set-huggingface-token', hfToken);
    } catch (e: any) {
      alert('Failed to save token: ' + (e.message || e));
    }
  };

  const downloadedNames = new Set(models.map(m => m.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Downloaded Models */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="codicon codicon-database" style={{ color: 'var(--accent-primary)' }} />
          Downloaded Models
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 4 }}>({models.length})</span>
        </h3>
        {models.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center' }}>
            No downloaded models. Search HuggingFace below to find and download GGUF models.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {models.map(m => (
              <div key={m.name}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                }}>
                  <span
                    onClick={() => setExpandedModel(expandedModel === m.name ? null : m.name)}
                    className={`codicon codicon-${expandedModel === m.name ? 'chevron-down' : 'chevron-right'}`}
                    style={{ color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span className="codicon codicon-file binary" style={{ color: 'var(--accent-primary)', fontSize: 14 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{formatSize(m.size)}</div>
                  </div>
                  {serverRunning && serverModel === m.name ? (
                    <button onClick={handleStopServer} style={{
                      padding: '4px 12px', fontSize: 11, fontWeight: 500,
                      background: '#ef4444', color: '#fff', border: 'none',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    }}>Stop</button>
                  ) : serverStarting === m.name ? (
                    <span style={{ color: 'var(--accent-primary)', fontSize: 11, fontWeight: 500 }}>Starting...</span>
                  ) : (
                    <button onClick={() => handleStartServer(m.path, m.name)} style={{
                      padding: '4px 12px', fontSize: 11, fontWeight: 500,
                      background: 'var(--accent-primary)', color: '#fff', border: 'none',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    }}>Run</button>
                  )}
                  <button onClick={() => handleDelete(m.name)} style={{
                    padding: '4px 8px', fontSize: 11,
                    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}>Delete</button>
                </div>
                {expandedModel === m.name && (
                  <div style={{
                    marginTop: 4, padding: '10px 12px 10px 36px',
                    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Context Size</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="range"
                        min={CTX_MIN}
                        max={CTX_MAX}
                        step={CTX_STEP}
                        value={modelContextSizes[m.name] ?? CTX_MIN}
                        onChange={e => handleContextSizeChange(m.name, parseInt(e.target.value, 10))}
                        style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                      />
                      <input
                        type="number"
                        min={CTX_MIN}
                        max={CTX_MAX}
                        step={CTX_STEP}
                        value={modelContextSizes[m.name] ?? CTX_MIN}
                        onChange={e => {
                          const v = Math.min(CTX_MAX, Math.max(CTX_MIN, parseInt(e.target.value, 10) || CTX_MIN));
                          handleContextSizeChange(m.name, v);
                        }}
                        style={{
                          width: 70, padding: '3px 6px', fontSize: 11,
                          background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)', borderRadius: '3px', outline: 'none', textAlign: 'center',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Range: {CTX_MIN} – {CTX_MAX} | Step: {CTX_STEP}
                      {serverRunning && serverModel === m.name ? (
                        <span style={{ marginLeft: 8, color: '#eab308', fontWeight: 500 }}>● Live — changing restarts server</span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Status */}
      {serverRunning && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontWeight: 600, color: '#22c55e' }}>● Server Active</span> — running <strong style={{ color: 'var(--text-primary)' }}>{serverModel}</strong> on port <strong>8080</strong>
        </div>
      )}

      {/* Search HuggingFace */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="codicon codicon-search" style={{ color: 'var(--accent-primary)' }} />
          Search HuggingFace
        </h3>
        <div style={{ marginBottom: 10, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>HuggingFace Token (Exp)</span>
            <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener" style={{ fontSize: 9, color: 'var(--accent-primary)' }}>Get token →</a>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password"
              value={hfToken}
              onChange={e => setHfToken(e.target.value)}
              placeholder="hf_..."
              style={{ flex: 1, padding: '3px 6px', fontSize: 10, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '3px', outline: 'none' }}
            />
            <button onClick={handleSaveHfToken} style={{
              padding: '3px 8px', fontSize: 10, fontWeight: 500,
              background: hfToken ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search for GGUF models (e.g. SmolLM2, Qwen2.5-Coder, Llama-3)"
            style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 12, boxSizing: 'border-box' }}
          />
          <button onClick={handleSearch} disabled={searching} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            background: searching ? 'var(--bg-input)' : 'var(--accent-primary)',
            color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: searching ? 'default' : 'pointer',
          }}>{searching ? 'Searching...' : 'Search'}</button>
        </div>

        {searchResults.map(hf => (
          <div key={hf.id} style={{
            padding: '10px 12px', marginBottom: 8,
            background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="codicon codicon-repo" style={{ color: 'var(--accent-primary)', fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{hf.id}</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{hf.downloads.toLocaleString()} downloads</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>{hf.description}</div>
            <div>
              {browsingRepos[hf.repo]?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {browsingRepos[hf.repo].map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: 10, color: 'var(--text-secondary)' }}>
                      <span>{f}</span>
                      {downloading === f ? (
                        <span style={{ color: 'var(--accent-primary)' }}>
                          {downloadProgress ? `${downloadProgress.percent}%` : '...'}
                        </span>
                      ) : downloadedNames.has(f) ? (
                        <span style={{ color: '#22c55e', fontSize: 9, fontWeight: 600 }}>Downloaded</span>
                      ) : (
                        <button onClick={() => handleDownload(hf.repo, f)} style={{
                          padding: '1px 6px', fontSize: 9, fontWeight: 600,
                          background: 'var(--accent-primary)', color: '#fff', border: 'none',
                          borderRadius: '3px', cursor: 'pointer',
                        }}>Download</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : browsingRepos[hf.repo]?.length === 0 ? (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '4px 0' }}>
                  No GGUF files found in this repo. <button onClick={() => handleBrowse(hf.repo)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 10, padding: 0 }}>Retry</button>
                </div>
              ) : (
                <button onClick={() => handleBrowse(hf.repo)} disabled={browsingLoading === hf.repo} style={{
                  padding: '3px 10px', fontSize: 10, fontWeight: 500,
                  background: browsingLoading === hf.repo ? 'var(--bg-input)' : 'transparent',
                  color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)',
                  borderRadius: 'var(--radius-sm)', cursor: browsingLoading === hf.repo ? 'default' : 'pointer',
                }}>
                  {browsingLoading === hf.repo ? 'Loading...' : 'Browse files'}
                </button>
              )}
            </div>
          </div>
        ))}
        {searchResults.length === 0 && searchQuery && !searching && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
            No GGUF models found. Try a different search term.
          </div>
        )}
      </div>

      {/* Download progress */}
      {downloading && downloadProgress && (
        <div style={{
          padding: 10, borderRadius: 'var(--radius-md)',
          background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Downloading: {downloading}</span>
            <span>{formatSize(downloadProgress.downloaded)} / {formatSize(downloadProgress.total)}</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${downloadProgress.percent}%`, height: '100%',
              background: 'var(--accent-primary)', borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Troubleshooting */}
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 16 }}>
        <div
          onClick={() => setTroubleshootingOpen(!troubleshootingOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
        >
          <span className={`codicon codicon-${troubleshootingOpen ? 'chevron-down' : 'chevron-right'}`} style={{ color: 'var(--text-secondary)', fontSize: 12 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Troubleshooting</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(antivirus false positives)</span>
        </div>
        {troubleshootingOpen && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Some antivirus software (Norton, Windows Defender) falsely flags <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>llama-server.exe</code> as <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>IDP.Generic</code>. This is a known false positive — the binary comes from the official <a href="https://github.com/ggml-org/llama.cpp" target="_blank" rel="noopener" style={{ color: 'var(--accent-primary)' }}>ggml-org/llama.cpp</a> release.
            </p>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary)' }}>How to fix:</p>
            <ol style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              <li>Open your antivirus quarantine / protection history</li>
              <li>Restore <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>llama-server.exe</code> from quarantine</li>
              <li>Add <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 3 }}>%APPDATA%\smart-cursor-x\bin</code> to your antivirus exclusion list</li>
            </ol>
            <button onClick={handleRedownload} disabled={redownloading} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: redownloading ? 'var(--bg-input)' : 'var(--accent-primary)',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: redownloading ? 'default' : 'pointer',
            }}>
              {redownloading ? 'Re-downloading...' : 'Re-download llama-server.exe'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
