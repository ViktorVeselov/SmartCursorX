import { useCallback } from 'react';

export type ApiErrorType = 'TIMEOUT' | 'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'UNKNOWN';

export interface ApiErrorInfo {
  type: ApiErrorType;
  message: string;
  timestamp: number;
  provider?: string;
  model?: string;
}

interface ApiErrorBannerProps {
  error: ApiErrorInfo | null;
  onDismiss: () => void;
  onRetry: () => void;
}

const ERROR_STYLES: Record<ApiErrorType, { bg: string; border: string; icon: string; label: string }> = {
  TIMEOUT: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.4)',
    icon: '⏱',
    label: 'Request Timed Out',
  },
  AUTH: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.4)',
    icon: '🔒',
    label: 'Authentication Error',
  },
  RATE_LIMIT: {
    bg: 'rgba(251, 146, 60, 0.12)',
    border: 'rgba(251, 146, 60, 0.4)',
    icon: '🔄',
    label: 'Rate Limited',
  },
  NETWORK: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.4)',
    icon: '🌐',
    label: 'Network Error',
  },
  UNKNOWN: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.4)',
    icon: '⚠',
    label: 'API Error',
  },
};

export function ApiErrorBanner({ error, onDismiss, onRetry }: ApiErrorBannerProps) {
  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  if (!error) return null;

  const style = ERROR_STYLES[error.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        margin: '8px 12px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.5,
      }}
      role="alert"
    >
      <span className={`codicon codicon-warning`} style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {style.label}
        </div>
        <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-word', fontSize: 12 }}>
          {error.message}
        </div>
        {error.provider && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4 }}>
            Provider: {error.provider}{error.model ? ` · Model: ${error.model}` : ''}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={handleRetry}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-primary)',
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1,
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
