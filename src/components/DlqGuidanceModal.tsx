import { useState, useEffect, useRef } from 'react';

interface DlqGuidanceModalProps {
  isOpen: boolean;
  taskId: number;
  taskTitle: string;
  failureFeedback: string;
  attemptHistory: string[];
  maxRetries: number;
  onClose: () => void;
}

export function DlqGuidanceModal({ isOpen, taskId, taskTitle, failureFeedback, attemptHistory, maxRetries, onClose }: DlqGuidanceModalProps) {
  const [guidance, setGuidance] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setGuidance('');
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleRetry = async () => {
    setSending(true);
    try {
      await window.ipcRenderer.invoke('execution:dlq-respond', taskId, guidance.trim() || null);
    } catch (err) {
      console.error('Failed to send DLQ response:', err);
    } finally {
      setSending(false);
      onClose();
    }
  };

  const handleCancel = async () => {
    setSending(true);
    try {
      await window.ipcRenderer.invoke('execution:dlq-respond', taskId, null);
    } catch (err) {
      console.error('Failed to cancel DLQ:', err);
    } finally {
      setSending(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dlq-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="dlq-modal" style={{
        background: '#1e1e1e', borderRadius: 8, padding: 24,
        maxWidth: 560, width: '90%', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 16,
        border: '1px solid #333', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h2 style={{ margin: 0, fontSize: 16, color: '#e06c75' }}>
          I tried {maxRetries} times and couldn't complete this task
        </h2>

        <div style={{ fontSize: 13, color: '#ccc' }}>
          <strong>Task:</strong> {taskTitle}
        </div>

        <div style={{
          background: '#2d2d2d', borderRadius: 4, padding: 12,
          maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#aaa',
          fontFamily: 'monospace', whiteSpace: 'pre-wrap',
        }}>
          {attemptHistory.map((entry, i) => (
            <div key={i} style={{ marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 8 }}>
              <span style={{ color: '#e06c75' }}>{entry}</span>
            </div>
          ))}
          <div style={{ color: '#e5c07b' }}>
            Final failure: {failureFeedback}
          </div>
        </div>

        <div style={{ fontSize: 13, color: '#999' }}>
          What should I do differently? Provide guidance for the retry:
        </div>

        <textarea
          ref={textareaRef}
          value={guidance}
          onChange={e => setGuidance(e.target.value)}
          placeholder="e.g. Use a different approach, check the database schema first, look at the error handling pattern in src/utils..."
          disabled={sending}
          style={{
            width: '100%', minHeight: 100, resize: 'vertical',
            background: '#252526', color: '#d4d4d4', border: '1px solid #3c3c3c',
            borderRadius: 4, padding: 10, fontSize: 13, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            disabled={sending}
            style={{
              padding: '8px 16px', borderRadius: 4, border: '1px solid #444',
              background: '#333', color: '#ccc', cursor: 'pointer', fontSize: 13,
            }}
          >
            Cancel Task
          </button>
          <button
            onClick={handleRetry}
            disabled={sending}
            style={{
              padding: '8px 16px', borderRadius: 4, border: 'none',
              background: '#4a9eff', color: '#fff', cursor: 'pointer', fontSize: 13,
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'Sending...' : 'Retry with Guidance'}
          </button>
        </div>
      </div>
    </div>
  );
}
