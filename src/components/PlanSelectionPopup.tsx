import type { SelectedTextInfo } from '../helpers/planEditorTypes';

interface PlanSelectionPopupProps {
    selectedTextInfo: SelectedTextInfo | null;
    showSelectionPopup: 'menu' | 'comment' | 'edit' | null;
    selectionPopupRef: React.RefObject<HTMLDivElement>;
    commentText: string;
    setCommentText: (v: string) => void;
    setEditInstruction: (v: string) => void;
    handleLeaveCommentSubmit: () => void;
    handleQuickEditSubmit: () => Promise<void>;
    isInlineAiLoading: boolean;
    setSelectedTextInfo: (v: SelectedTextInfo | null) => void;
    setShowSelectionPopup: (v: 'menu' | 'comment' | 'edit' | null) => void;
}

// eslint-disable-next-line complexity
export function PlanSelectionPopup({
    selectedTextInfo, showSelectionPopup, selectionPopupRef,
    commentText, setCommentText, setEditInstruction,
    handleLeaveCommentSubmit, handleQuickEditSubmit,
    isInlineAiLoading, setSelectedTextInfo, setShowSelectionPopup
}: PlanSelectionPopupProps) {
    if (!selectedTextInfo || !showSelectionPopup) return null;

    return (
        <div ref={selectionPopupRef} style={{
            position: 'fixed',
            top: `${selectedTextInfo.y}px`,
            left: `${selectedTextInfo.x}px`,
            zIndex: 9999,
            background: '#1c1c1e',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontFamily: 'Inter, sans-serif',
            color: 'white',
            animation: 'fade-in-popover 0.2s ease-out',
            minWidth: '320px',
            width: '320px'
        }}>
            <style>{`
                @keyframes fade-in-popover {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {showSelectionPopup === 'menu' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Selection Action</span>
                        <button
                            onClick={() => { setSelectedTextInfo(null); setShowSelectionPopup(null); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                padding: '2px 4px'
                            }}
                        >✕</button>
                    </div>
                    <input
                        type="text"
                        placeholder="Type comment (Enter) or AI instructions (Ctrl+Enter)..."
                        value={commentText}
                        onChange={e => {
                            setCommentText(e.target.value);
                            setEditInstruction(e.target.value);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (e.ctrlKey) {
                                    handleQuickEditSubmit();
                                } else {
                                    handleLeaveCommentSubmit();
                                }
                            }
                        }}
                        autoFocus
                        style={{
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px',
                            color: 'white',
                            padding: '6px 8px',
                            fontSize: '11.5px',
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                        <button
                            onClick={handleLeaveCommentSubmit}
                            disabled={!commentText.trim()}
                            style={{
                                padding: '5px 10px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                color: commentText.trim() ? 'white' : 'rgba(255,255,255,0.25)',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: commentText.trim() ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span className="codicon codicon-comment" style={{ color: commentText.trim() ? '#818cf8' : 'rgba(255,255,255,0.25)', fontSize: '12px' }} /> Comment
                        </button>
                        <button
                            onClick={handleQuickEditSubmit}
                            disabled={!commentText.trim() || isInlineAiLoading}
                            style={{
                                padding: '5px 10px',
                                background: !commentText.trim() || isInlineAiLoading ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                                border: 'none',
                                borderRadius: '4px',
                                color: !commentText.trim() || isInlineAiLoading ? 'rgba(255,255,255,0.25)' : 'white',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: !commentText.trim() || isInlineAiLoading ? 'default' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {isInlineAiLoading ? (
                                <>
                                    <span className="codicon codicon-loading codicon-modifier-spin" /> Modifying...
                                </>
                            ) : (
                                <>
                                    <span className="codicon codicon-zap" style={{ color: !commentText.trim() ? 'rgba(255,255,255,0.25)' : '#fbbf24', fontSize: '12px' }} /> AI Edit
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
