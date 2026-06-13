export const CredentialBadge = ({ status }: { status?: { hasKey: boolean; encryptionAvailable: boolean } }) => {
    if (!status || !status.hasKey) {
        return (
            <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10, 
                color: 'var(--text-secondary)', 
                background: 'rgba(255,255,255,0.03)', 
                padding: '1px 5px', 
                borderRadius: 4,
                fontWeight: 500,
                opacity: 0.7
            }}>
                <span className="codicon codicon-circle-outline" style={{ fontSize: 9 }} /> Not Set
            </span>
        );
    }
    if (!status.encryptionAvailable) {
        return (
            <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10, 
                color: '#f59e0b', 
                background: 'rgba(245,158,11,0.08)', 
                padding: '1px 5px', 
                borderRadius: 4,
                fontWeight: 500
            }}>
                <span className="codicon codicon-warning" style={{ fontSize: 9 }} /> Plaintext
            </span>
        );
    }
    return (
        <span style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10, 
            color: '#34d399', 
            background: 'rgba(52,211,153,0.08)', 
            padding: '1px 5px', 
            borderRadius: 4,
            fontWeight: 500
        }}>
            <span className="codicon codicon-lock" style={{ fontSize: 9 }} /> Encrypted
        </span>
    );
};
