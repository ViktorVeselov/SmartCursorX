import { MarkdownRenderer } from './MarkdownRenderer';
import type { ExecutionPlan } from '../helpers/planEditorTypes';

interface ParsedComment {
    id: string;
    body: string;
    context: string;
    rawBlock: string;
}

interface SelectedTextInfo {
    text: string;
    start: number;
    end: number;
    isTextarea: boolean;
    x: number;
    y: number;
}

interface PlanDocTabProps {
    plan: ExecutionPlan;
    savePlan: (plan: ExecutionPlan) => Promise<void>;
    containerRef: React.RefObject<HTMLDivElement>;
    cleanDoc: string;
    parsedDocComments: ParsedComment[];
    parsedComments: ParsedComment[];
    commentOffsets: Record<string, number>;
    hoveredCommentId: string | null;
    setHoveredCommentId: (v: string | null) => void;
    editingCommentId: string | null;
    setEditingCommentId: (v: string | null) => void;
    editingCommentBody: string;
    setEditingCommentBody: (v: string) => void;
    handleEditComment: (comment: { rawBlock: string; context: string }, newBody: string) => void;
    handleDeleteComment: (comment: { rawBlock: string }) => void;
    handleCopyDoc: () => Promise<void>;
    copiedDoc: boolean;
    showAddDocComment: boolean;
    setShowAddDocComment: (v: boolean) => void;
    newDocComment: string;
    setNewDocComment: (v: string) => void;
    selectedTextInfo: SelectedTextInfo | null;
}

export function PlanDocTab({
    plan,
    savePlan,
    containerRef,
    cleanDoc,
    parsedDocComments,
    parsedComments,
    commentOffsets,
    hoveredCommentId,
    setHoveredCommentId,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    handleEditComment,
    handleDeleteComment,
    handleCopyDoc,
    copiedDoc,
    showAddDocComment,
    setShowAddDocComment,
    newDocComment,
    setNewDocComment,
    selectedTextInfo,
}: PlanDocTabProps) {
    const showDocCommentsRoom = parsedDocComments.length > 0 || !!selectedTextInfo;
    return (
        <div style={{
            background: 'transparent',
            border: 'none',
            borderRadius: '12px',
            padding: '0 24px',
            position: 'relative',
            width: '100%',
            maxWidth: showDocCommentsRoom ? '1170px' : '850px',
            margin: '0 auto',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="codicon codicon-note" style={{ color: '#c084fc' }} /> Detailed Design Document
                </h3>
                <div className="add-doc-comment-container" style={{ position: 'relative', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                        onClick={handleCopyDoc}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: copiedDoc ? '#4ade80' : 'white',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span className={`codicon ${copiedDoc ? 'codicon-check' : 'codicon-copy'}`} />
                        <span>{copiedDoc ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        onClick={() => setShowAddDocComment(!showAddDocComment)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: 'white',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                        title="Add Refactor Comment"
                    >
                        <span className="codicon codicon-add" />
                    </button>

                    {showAddDocComment && (
                        <div style={{
                            position: 'absolute',
                            top: '30px',
                            right: 0,
                            width: '280px',
                            background: 'rgba(15, 23, 42, 0.98)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '10px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                                Add Refactor Comment
                            </div>
                            <textarea
                                value={newDocComment}
                                onChange={e => setNewDocComment(e.target.value)}
                                placeholder="Enter instruction or comment for refactoring..."
                                style={{
                                    width: '100%',
                                    height: '60px',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    color: 'white',
                                    padding: '6px',
                                    fontSize: '11px',
                                    outline: 'none',
                                    resize: 'none',
                                    fontFamily: 'inherit'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                    onClick={() => {
                                        setShowAddDocComment(false);
                                        setNewDocComment('');
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '10px', cursor: 'pointer' }}
                                >Cancel</button>
                                <button
                                    onClick={() => {
                                        if (newDocComment.trim()) {
                                            const targetClean = "Detailed Design Document";
                                            const commentString = `\n> \u{1F4AC} **Refactor Comment:** ${newDocComment.trim()} \u2014 *on: "${targetClean}"*`;
                                            const originalDoc = plan.designDoc || '';
                                            const newText = originalDoc.trim() + `\n\n` + commentString;
                                            savePlan({ ...plan, designDoc: newText });
                                            setShowAddDocComment(false);
                                            setNewDocComment('');
                                        }
                                    }}
                                    style={{
                                        background: '#818cf8',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        padding: '4px 10px'
                                    }}
                                >Add Comment</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '300px'
                }}
            >
                {/* Left: Doc Preview */}
                <div
                    className="design-doc-markdown"
                    style={{
                        marginRight: showDocCommentsRoom ? '320px' : '0',
                        color: 'rgba(255, 255, 255, 0.8)',
                        minHeight: '300px',
                        transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <MarkdownRenderer
                        content={cleanDoc || '# Design Specification\n\n*No design details added yet.*'}
                        comments={parsedComments}
                        hoveredCommentId={hoveredCommentId}
                        onHoverComment={setHoveredCommentId}
                        onContentChange={(newContent) => {
                            const commentsString = parsedDocComments.map(c => c.rawBlock).join('\n');
                            const finalDoc = newContent.trim() + (commentsString ? '\n\n' + commentsString : '');
                            savePlan({ ...plan, designDoc: finalDoc });
                        }}
                    />
                </div>

                {/* Floating Comment Cards directly on top of / inside the card container */}
                {parsedComments.map((comment, index) => {
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
                })}
            </div>
        </div>
    );
}
