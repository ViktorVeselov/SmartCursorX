import type { ParsedComment } from '../helpers/planEditorTypes';

interface PlanningCommentCardProps {
    comment: ParsedComment;
    index: number;
    commentOffsets: Record<string, number>;
    hoveredCommentId: string | null;
    setHoveredCommentId: (v: string | null) => void;
    editingCommentId: string | null;
    setEditingCommentId: (v: string | null) => void;
    editingCommentBody: string;
    setEditingCommentBody: (v: string) => void;
    handleEditComment: (comment: { rawBlock: string; context: string }, newBody: string) => void;
    handleDeleteComment: (comment: { rawBlock: string }) => void;
}

export function PlanningCommentCard({
    comment,
    index,
    commentOffsets,
    hoveredCommentId,
    setHoveredCommentId,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    handleEditComment,
    handleDeleteComment,
}: PlanningCommentCardProps) {
    const top = commentOffsets[comment.id] !== undefined ? commentOffsets[comment.id] : (index * 80);
    const isHovered = hoveredCommentId === comment.id;
    const isEditing = editingCommentId === comment.id;

    return (
        <div
            key={comment.id}
            onMouseEnter={() => setHoveredCommentId(comment.id)}
            onMouseLeave={() => setHoveredCommentId(null)}
            style={{
                position: 'absolute',
                top: `${top}px`,
                right: 0,
                width: '280px',
                background: isHovered
                    ? 'rgba(30, 41, 59, 0.85)'
                    : 'transparent',
                border: isHovered
                    ? '1px solid rgba(129, 140, 248, 0.4)'
                    : '1px solid transparent',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isHovered
                    ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(129, 140, 248, 0.1)'
                    : 'none',
                zIndex: isHovered ? 10 : 1,
                backdropFilter: isHovered ? 'blur(10px)' : 'none',
                boxSizing: 'border-box'
            }}
        >
            {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    <textarea
                        value={editingCommentBody}
                        onChange={e => setEditingCommentBody(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleEditComment(comment, editingCommentBody);
                                setEditingCommentId(null);
                            } else if (e.key === 'Escape') {
                                setEditingCommentId(null);
                            }
                        }}
                        autoFocus
                        style={{
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: 'white',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            outline: 'none',
                            width: '100%',
                            resize: 'vertical',
                            minHeight: '40px',
                            fontFamily: 'inherit'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setEditingCommentId(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                handleEditComment(comment, editingCommentBody);
                                setEditingCommentId(null);
                            }}
                            style={{
                                background: '#818cf8',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                padding: '2px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <span style={{
                        fontSize: '12.5px',
                        color: isHovered ? 'white' : 'rgba(255, 255, 255, 0.65)',
                        lineHeight: 1.45,
                        flex: 1,
                        wordBreak: 'break-word',
                        fontWeight: 400,
                        transition: 'color 0.2s ease'
                    }}>
                        {comment.body}
                    </span>
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexShrink: 0,
                        marginTop: '2px',
                        opacity: isHovered ? 1 : 0,
                        pointerEvents: isHovered ? 'auto' : 'none',
                        transition: 'opacity 0.2s ease'
                    }}>
                        <button
                            onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentBody(comment.body);
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Edit Comment"
                            onMouseOver={e => e.currentTarget.style.color = '#818cf8'}
                            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                        >
                            <span className="codicon codicon-edit" style={{ fontSize: '12px' }} />
                        </button>
                        <button
                            onClick={() => handleDeleteComment(comment)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Delete Comment"
                            onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                        >
                            <span className="codicon codicon-trash" style={{ fontSize: '12px' }} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
