import { MarkdownRenderer } from './MarkdownRenderer';
import type { ExecutionPlan, ParsedComment } from '../helpers/planEditorTypes';

interface PlanBlueprintsTabProps {
    plan: ExecutionPlan;
    savePlan: (plan: ExecutionPlan) => Promise<void>;
    cleanPlanning: string;
    isDetailedPlanningLoading: boolean;
    planningDirectives: string;
    setPlanningDirectives: (v: string) => void;
    handleDetailedPlanning: (directives?: string) => Promise<void>;
    handleCopyPlanning: () => Promise<void>;
    copiedPlanning: boolean;
    showAddPlanningComment: boolean;
    setShowAddPlanningComment: (v: boolean) => void;
    newPlanningComment: string;
    setNewPlanningComment: (v: string) => void;
    parsedComments: ParsedComment[];
    parsedPlanningComments: ParsedComment[];
    hoveredCommentId: string | null;
    setHoveredCommentId: (v: string | null) => void;
    showPlanningCommentsRoom: boolean;
}

export function PlanBlueprintsTab({
    plan,
    savePlan,
    cleanPlanning,
    isDetailedPlanningLoading,
    planningDirectives,
    setPlanningDirectives,
    handleDetailedPlanning,
    handleCopyPlanning,
    copiedPlanning,
    showAddPlanningComment,
    setShowAddPlanningComment,
    newPlanningComment,
    setNewPlanningComment,
    parsedComments,
    parsedPlanningComments,
    hoveredCommentId,
    setHoveredCommentId,
    showPlanningCommentsRoom,
}: PlanBlueprintsTabProps) {
    if (isDetailedPlanningLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '20px 0',
                animation: 'pulse-skeleton 1.5s infinite ease-in-out'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="codicon codicon-loading codicon-modifier-spin" style={{ color: '#f97316', fontSize: '16px' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Architecting Code Planning Blueprints...</span>
                </div>
                <div style={{ height: '20px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', width: '40%' }} />
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', width: '85%' }} />
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', width: '70%' }} />
                <div style={{ height: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', width: '90%' }} />
                <div style={{ height: '100px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', width: '100%', marginTop: '12px' }} />
            </div>
        );
    }

    if (!cleanPlanning || !cleanPlanning.trim()) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                gap: '16px'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(234, 88, 12, 0.1)',
                    border: '1px solid rgba(234, 88, 12, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f97316',
                    boxShadow: '0 0 20px rgba(234, 88, 12, 0.15)',
                    animation: 'pulse-glow 2s infinite ease-in-out'
                }}>
                    <span className="codicon codicon-code" style={{ fontSize: '28px' }} />
                </div>
                <style>{`
                    @keyframes pulse-glow {
                        0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(234, 88, 12, 0.15); }
                        50% { transform: scale(1.03); box-shadow: 0 0 30px rgba(234, 88, 12, 0.3); }
                    }
                `}</style>
                <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: 'white' }}>Generate Code Blueprints</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', maxWidth: '420px', lineHeight: '1.5' }}>
                        Create detailed specifications, code drafts, and modules structure mapping. You can write custom directives to guide the AI architect.
                    </p>
                </div>
                <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <textarea
                        value={planningDirectives}
                        onChange={e => setPlanningDirectives(e.target.value)}
                        placeholder="Add custom directives (e.g. 'Use React hooks', 'Follow absolute path structures', 'Create helper utility first') (optional)..."
                        style={{
                            width: '100%',
                            height: '80px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: 'white',
                            padding: '10px',
                            fontSize: '12px',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            lineHeight: '1.4'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                            onClick={() => {
                                savePlan({ ...plan, codePlanning: '# Code Planning Blueprints\n\nWrite detailed code drafts and specs here...' });
                            }}
                            style={{
                                padding: '6px 14px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                            Write Manually
                        </button>
                        <button
                            onClick={() => handleDetailedPlanning(planningDirectives)}
                            disabled={isDetailedPlanningLoading}
                            style={{
                                padding: '6px 16px',
                                background: 'linear-gradient(135deg, #ff8c3a 0%, #ea580c 100%)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: isDetailedPlanningLoading ? 'default' : 'pointer',
                                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {isDetailedPlanningLoading ? (
                                <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '11px' }} />
                            ) : (
                                <span className="codicon codicon-sparkles" style={{ fontSize: '11px' }} />
                            )}
                            <span>Generate with AI</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="codicon codicon-code" style={{ color: '#f97316' }} /> Code Planning Blueprints
                </h3>
                <div className="add-planning-comment-container" style={{ position: 'relative', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                        onClick={handleCopyPlanning}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: copiedPlanning ? '#4ade80' : 'white',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span className={`codicon ${copiedPlanning ? 'codicon-check' : 'codicon-copy'}`} />
                        <span>{copiedPlanning ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                        onClick={() => setShowAddPlanningComment(!showAddPlanningComment)}
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

                    {showAddPlanningComment && (
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
                                value={newPlanningComment}
                                onChange={e => setNewPlanningComment(e.target.value)}
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
                                        setShowAddPlanningComment(false);
                                        setNewPlanningComment('');
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '10px', cursor: 'pointer' }}
                                >Cancel</button>
                                <button
                                    onClick={() => {
                                        if (newPlanningComment.trim()) {
                                            const targetClean = "Code Planning Blueprints";
                                            const commentString = `\n> \u{1F4AC} **Refactor Comment:** ${newPlanningComment.trim()} \u2014 *on: "${targetClean}"*`;
                                            const originalPlanning = plan.codePlanning || '';
                                            const newText = originalPlanning.trim() + `\n\n` + commentString;
                                            savePlan({ ...plan, codePlanning: newText });
                                            setShowAddPlanningComment(false);
                                            setNewPlanningComment('');
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
                className="code-planning-markdown"
                style={{
                    marginRight: showPlanningCommentsRoom ? '320px' : '0',
                    color: 'rgba(255, 255, 255, 0.8)',
                    minHeight: '300px',
                    transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <MarkdownRenderer
                    content={cleanPlanning || '# Code Planning Blueprints\n\n*No code planning blueprints generated yet. Click "Code Planning" above to generate them.*'}
                    comments={parsedComments}
                    hoveredCommentId={hoveredCommentId}
                    onHoverComment={setHoveredCommentId}
                    onContentChange={(newContent) => {
                        const commentsString = parsedPlanningComments.map(c => c.rawBlock).join('\n');
                        const finalPlanning = newContent.trim() + (commentsString ? '\n\n' + commentsString : '');
                        savePlan({ ...plan, codePlanning: finalPlanning });
                    }}
                />
            </div>
        </div>
    );
}
