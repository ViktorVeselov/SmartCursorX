import { useState, useEffect, useRef } from 'react';

interface ToolApprovalRequest {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  description: string;
  timestamp: number;
}

interface ToolApprovalDialogProps {
  requests: ToolApprovalRequest[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onClose: () => void;
}

function formatArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

export function ToolApprovalDialog({ requests, onApprove, onDeny, onClose }: ToolApprovalDialogProps) {
  if (requests.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const request = requests[currentIndex];

  useEffect(() => {
    setCurrentIndex(0);
  }, [requests]);

  if (!request) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tool-approval-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Tool Execution Request</h3>
          <span className="request-count">{currentIndex + 1} of {requests.length}</span>
        </div>

        <div className="dialog-content">
          <div className="tool-info">
            <div className="tool-name">{request.toolName}</div>
            <div className="tool-description">{request.description}</div>
          </div>

          <div className="tool-args">
            <label>Arguments:</label>
            <pre>{formatArgs(request.args)}</pre>
          </div>

          <div className="tool-warning">
            ⚠ This action will modify files in your workspace. Review the arguments before approving.
          </div>
        </div>

        <div className="dialog-actions">
          <button className="secondary" onClick={() => onDeny(request.id)}>
            Deny
          </button>
          <button className="primary" onClick={() => onApprove(request.id)}>
            Allow
          </button>
          <button className="secondary" onClick={onClose}>
            Cancel All
          </button>
        </div>
      </div>
    </div>
  );
}