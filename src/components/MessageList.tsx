import { forwardRef } from 'react';
import { ChatMessageCard, type ChatMessage } from './ChatMessageCard';

interface QueuedMessage {
    content: string;
    attachedFile?: { name: string; path: string; content: string } | null;
    isPlanMode?: boolean;
    id: number;
}

interface MessageListProps {
    messages: Record<string, unknown>[];
    messageQueue: QueuedMessage[];
    streamElapsed: number;
    currentlyReadingFiles: { path: string; timestamp: number }[];
    onApplyCode?: (code: string) => void;
    onRollback: (messageId: number) => void;
    activeConversationId: string | null;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList({
    messages,
    messageQueue,
    streamElapsed,
    currentlyReadingFiles,
    onApplyCode,
    onRollback,
    activeConversationId,
    onOpenPlan,
}, scrollContainerRef) {
    const filteredMsgs = messages.filter((m) => {
        const role = (m as Record<string, unknown>).role;
        const content = (m as Record<string, unknown>).content as string;
        if (role === 'system') {
            return content && content !== 'You are a helpful coding assistant.';
        }
        return true;
    });
    return (
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredMsgs.map((msg, i: number) => (
                <ChatMessageCard
                    key={i}
                    msg={msg as unknown as ChatMessage}
                    streamElapsed={streamElapsed}
                    currentlyReadingFiles={currentlyReadingFiles}
                    onApplyCode={onApplyCode}
                    onRollback={onRollback}
                    activeConversationId={activeConversationId}
                    onOpenPlan={onOpenPlan}
                />
            ))}
            {messageQueue.map((qm, qi) => (
                <div
                    key={`queued-${qi}`}
                    style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        opacity: 0.7,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px dashed rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        animation: 'fadeInUp 0.3s ease-out'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span className="codicon codicon-history" />
                        <span style={{ fontWeight: 500 }}>Queued ({qi + 1}/{messageQueue.length})</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                        {qm.content}
                    </div>
                </div>
            ))}
        </div>
    );
});
