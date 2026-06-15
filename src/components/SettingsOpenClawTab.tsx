const getIpc = () => window.ipcRenderer;

interface SettingsOpenClawTabProps {
    openClawInstalled: boolean;
    setOpenClawInstalled: (v: boolean) => void;
    openClawIsRunning: boolean;
    setOpenClawIsRunning: (v: boolean) => void;
    openClawVersion: string;
    openClawPort: number;
    setOpenClawPort: (v: number) => void;
    openClawLogs: string[];
    setOpenClawLogs: (v: string[]) => void;
    doctorLogs: string;
    setDoctorLogs: (v: string) => void;
    doctorRunning: boolean;
    setDoctorRunning: (v: boolean) => void;
    pairingChannel: string;
    setPairingChannel: (v: string) => void;
    pairingCode: string;
    setPairingCode: (v: string) => void;
    pairingStatus: { type: 'idle' | 'success' | 'error'; message: string };
    setPairingStatus: (v: { type: 'idle' | 'success' | 'error'; message: string }) => void;
    isPairingRunning: boolean;
    setIsPairingRunning: (v: boolean) => void;
}

// eslint-disable-next-line complexity
export function SettingsOpenClawTab(props: SettingsOpenClawTabProps) {
    const {
        openClawInstalled, setOpenClawInstalled,
        openClawIsRunning, setOpenClawIsRunning,
        openClawVersion,
        openClawPort, setOpenClawPort,
        openClawLogs, setOpenClawLogs,
        doctorLogs, setDoctorLogs,
        doctorRunning, setDoctorRunning,
        pairingChannel, setPairingChannel,
        pairingCode, setPairingCode,
        pairingStatus, setPairingStatus,
        isPairingRunning, setIsPairingRunning,
    } = props;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ marginTop: 0, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>OpenClaw</span> Personal AI Assistant
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
                                    } catch (e: unknown) {
                                        setPairingStatus({ type: 'error', message: (e as Error).message || 'Error occurred.' });
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
    );
}
