import type { ExecutionPlan, ActiveTab, PlanningSubTab, ParsedComment, SelectedTextInfo } from '../helpers/planEditorTypes';
import { PlanBlueprintsTab } from './PlanBlueprintsTab';
import { PlanTradeoffsView } from './PlanTradeoffsView';
import { PlanConsequencesView } from './PlanConsequencesView';
import { PlanningCommentCard } from './PlanningCommentCard';

interface PlanPlanningTabProps {
    plan: ExecutionPlan;
    savePlan: (plan: ExecutionPlan) => Promise<void>;
    setPlan: (plan: ExecutionPlan) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    activeTab: ActiveTab;
    planningSubTab: PlanningSubTab;
    setPlanningSubTab: (v: PlanningSubTab) => void;
    isDetailedPlanningLoading: boolean;
    planningDirectives: string;
    setPlanningDirectives: (v: string) => void;
    handleDetailedPlanning: (directives?: string) => Promise<void>;
    cleanPlanning: string;
    parsedComments: ParsedComment[];
    parsedPlanningComments: ParsedComment[];
    commentOffsets: Record<string, number>;
    hoveredCommentId: string | null;
    setHoveredCommentId: (v: string | null) => void;
    editingCommentId: string | null;
    setEditingCommentId: (v: string | null) => void;
    editingCommentBody: string;
    setEditingCommentBody: (v: string) => void;
    handleEditComment: (comment: { rawBlock: string; context: string }, newBody: string) => void;
    handleDeleteComment: (comment: { rawBlock: string }) => void;
    handleCopyPlanning: () => Promise<void>;
    copiedPlanning: boolean;
    showAddPlanningComment: boolean;
    setShowAddPlanningComment: (v: boolean) => void;
    newPlanningComment: string;
    setNewPlanningComment: (v: string) => void;
    handleTextareaSelect: () => void;
    handleTextareaMouseUp: () => void;
    getTargetIdForField: (text: string) => string | undefined;
    selectedTextInfo: SelectedTextInfo | null;
}

// eslint-disable-next-line complexity
export function PlanPlanningTab({
    plan,
    savePlan,
    setPlan,
    containerRef,
    activeTab,
    planningSubTab,
    setPlanningSubTab,
    isDetailedPlanningLoading,
    planningDirectives,
    setPlanningDirectives,
    handleDetailedPlanning,
    cleanPlanning,
    parsedComments,
    parsedPlanningComments,
    commentOffsets,
    hoveredCommentId,
    setHoveredCommentId,
    editingCommentId,
    setEditingCommentId,
    editingCommentBody,
    setEditingCommentBody,
    handleEditComment,
    handleDeleteComment,
    handleCopyPlanning,
    copiedPlanning,
    showAddPlanningComment,
    setShowAddPlanningComment,
    newPlanningComment,
    setNewPlanningComment,
    handleTextareaSelect,
    handleTextareaMouseUp,
    getTargetIdForField,
    selectedTextInfo,
}: PlanPlanningTabProps) {
    const showPlanningCommentsRoom = parsedComments.length > 0 || !!selectedTextInfo;

    return (
        <div style={{
            background: 'transparent',
            border: 'none',
            borderRadius: '12px',
            padding: '0 24px',
            position: 'relative',
            width: '100%',
            maxWidth: showPlanningCommentsRoom ? '1170px' : '850px',
            margin: '0 auto',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <style>{`
                @keyframes pulse-skeleton {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {activeTab === 'planning' && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '24px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={() => setPlanningSubTab('blueprints')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: planningSubTab === 'blueprints' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                            border: '1px solid ' + (planningSubTab === 'blueprints' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                            color: planningSubTab === 'blueprints' ? '#f97316' : 'rgba(255, 255, 255, 0.5)',
                            fontSize: '12.5px',
                            fontWeight: planningSubTab === 'blueprints' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span className="codicon codicon-code" />
                        Code Blueprints
                    </button>
                    <button
                        onClick={() => setPlanningSubTab('tradeoffs')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: planningSubTab === 'tradeoffs' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            border: '1px solid ' + (planningSubTab === 'tradeoffs' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                            color: planningSubTab === 'tradeoffs' ? '#38bdf8' : 'rgba(255, 255, 255, 0.5)',
                            fontSize: '12.5px',
                            fontWeight: planningSubTab === 'tradeoffs' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span className="codicon codicon-law" />
                        Implementation Trade-offs
                    </button>
                    <button
                        onClick={() => setPlanningSubTab('consequences')}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: planningSubTab === 'consequences' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                            border: '1px solid ' + (planningSubTab === 'consequences' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.05)'),
                            color: planningSubTab === 'consequences' ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)',
                            fontSize: '12.5px',
                            fontWeight: planningSubTab === 'consequences' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span className="codicon codicon-warning" />
                        Failure Modes & Consequences
                    </button>
                </div>
            )}

            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: '300px'
                }}
            >
                {activeTab === 'planning' && planningSubTab === 'blueprints' ? (
                    <PlanBlueprintsTab
                        plan={plan}
                        savePlan={savePlan}
                        cleanPlanning={cleanPlanning}
                        isDetailedPlanningLoading={isDetailedPlanningLoading}
                        planningDirectives={planningDirectives}
                        setPlanningDirectives={setPlanningDirectives}
                        handleDetailedPlanning={handleDetailedPlanning}
                        handleCopyPlanning={handleCopyPlanning}
                        copiedPlanning={copiedPlanning}
                        showAddPlanningComment={showAddPlanningComment}
                        setShowAddPlanningComment={setShowAddPlanningComment}
                        newPlanningComment={newPlanningComment}
                        setNewPlanningComment={setNewPlanningComment}
                        parsedComments={parsedComments}
                        parsedPlanningComments={parsedPlanningComments}
                        hoveredCommentId={hoveredCommentId}
                        setHoveredCommentId={setHoveredCommentId}
                        showPlanningCommentsRoom={showPlanningCommentsRoom}
                    />
                ) : (activeTab === 'tradeoffs' || (activeTab === 'planning' && planningSubTab === 'tradeoffs')) ? (
                    <PlanTradeoffsView
                        plan={plan}
                        savePlan={savePlan}
                        setPlan={setPlan}
                        activeTab={activeTab}
                        handleTextareaSelect={handleTextareaSelect}
                        handleTextareaMouseUp={handleTextareaMouseUp}
                        getTargetIdForField={getTargetIdForField}
                        showPlanningCommentsRoom={showPlanningCommentsRoom}
                    />
                ) : (
                    <PlanConsequencesView
                        plan={plan}
                        savePlan={savePlan}
                        setPlan={setPlan}
                        activeTab={activeTab}
                        handleTextareaSelect={handleTextareaSelect}
                        handleTextareaMouseUp={handleTextareaMouseUp}
                        getTargetIdForField={getTargetIdForField}
                        showPlanningCommentsRoom={showPlanningCommentsRoom}
                    />
                )}

                {parsedComments.map((comment, index) => (
                    <PlanningCommentCard
                        key={comment.id}
                        comment={comment}
                        index={index}
                        commentOffsets={commentOffsets}
                        hoveredCommentId={hoveredCommentId}
                        setHoveredCommentId={setHoveredCommentId}
                        editingCommentId={editingCommentId}
                        setEditingCommentId={setEditingCommentId}
                        editingCommentBody={editingCommentBody}
                        setEditingCommentBody={setEditingCommentBody}
                        handleEditComment={handleEditComment}
                        handleDeleteComment={handleDeleteComment}
                    />
                ))}
            </div>
        </div>
    );
}
