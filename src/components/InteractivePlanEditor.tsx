import { useState, useEffect } from 'react';
import { unwrapPlanningText } from '../utils/jsonParser';
import { parseCommentsFromText } from '../helpers/planEditorUtils';
import type { PlanStep, ActiveTab, PlanningSubTab } from '../helpers/planEditorTypes';
import { PlanOverviewTab } from './PlanOverviewTab';
import { PlanFlowTab } from './PlanFlowTab';
import { PlanStepsTab } from './PlanStepsTab';
import { PlanDocTab } from './PlanDocTab';
import { PlanPlanningTab } from './PlanPlanningTab';
import { PlanApprovalBanner } from './PlanApprovalBanner';
import { PlanNavigationTabs } from './PlanNavigationTabs';
import { PlanAiModifyBar } from './PlanAiModifyBar';
import { PlanSelectionPopup } from './PlanSelectionPopup';
import { useAiStream } from './useAiStream';
import { useDetailedPlanning } from './useDetailedPlanning';
import { usePlanModifier } from './usePlanModifier';
import { useCommentOffsets } from './useCommentOffsets';
import { usePlanLoader } from './usePlanLoader';
import { useInlineEdit } from './useInlineEdit';

interface InteractivePlanEditorProps {
    taskId: number;
}

// eslint-disable-next-line complexity
export function InteractivePlanEditor({ taskId }: InteractivePlanEditorProps) {
    const { plan, setPlan, savePlan, agents, workflows } = usePlanLoader(taskId);
    const [activeTab, setActiveTab] = useState<ActiveTab>('doc');
    const [planningSubTab, setPlanningSubTab] = useState<PlanningSubTab>('blueprints');
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionMessage, setExecutionMessage] = useState('');

    useEffect(() => {
        const cleanup = window.ipcRenderer.on('execution:progress', (_event: any, data: { message: string }) => {
            if (data.message) setExecutionMessage(data.message);
        }) as unknown as () => void;
        return () => cleanup();
    }, []);

    // Details & Context states
    const [isEditingExpectedOutcome, setIsEditingExpectedOutcome] = useState(false);
    const [editingExpectedOutcomeText, setEditingExpectedOutcomeText] = useState('');

    const [editingReadIndex, setEditingReadIndex] = useState<number | null>(null);
    const [editingReadText, setEditingReadText] = useState('');
    const [newReadText, setNewReadText] = useState('');
    const [showAddRead, setShowAddRead] = useState(false);

    const [editingModifyIndex, setEditingModifyIndex] = useState<number | null>(null);
    const [editingModifyText, setEditingModifyText] = useState('');
    const [newModifyText, setNewModifyText] = useState('');
    const [showAddModify, setShowAddModify] = useState(false);

    const [editingCritIndex, setEditingCritIndex] = useState<number | null>(null);
    const [editingCritText, setEditingCritText] = useState('');
    const [newCritText, setNewCritText] = useState('');
    const [showAddCrit, setShowAddCrit] = useState(false);

    // Comments & Copy Doc States
    const [copiedDoc, setCopiedDoc] = useState(false);
    const [showAddDocComment, setShowAddDocComment] = useState(false);
    const [newDocComment, setNewDocComment] = useState('');

    const [copiedPlanning, setCopiedPlanning] = useState(false);
    const [showAddPlanningComment, setShowAddPlanningComment] = useState(false);
    const [newPlanningComment, setNewPlanningComment] = useState('');

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    // Step Editing & Hover States
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [editStepData, setEditStepData] = useState<PlanStep | null>(null);
    const [activeAgentPopoverIndex, setActiveAgentPopoverIndex] = useState<number | null>(null);
    const [agentSearchQuery, setAgentSearchQuery] = useState('');
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const handleTextareaSelect = () => {};
    const handleTextareaMouseUp = () => {};

    // AI & Planning Hooks
    const {
        isDetailedPlanningLoading,
        showPlanningInput,
        setShowPlanningInput,
        planningDirectives,
        setPlanningDirectives,
        handleDetailedPlanning: handleDetailedPlanningFromHook
    } = useDetailedPlanning();

    const {
        aiInstructions,
        setAiInstructions,
        isAiLoading,
        inlineAiError,
        handleModifyWithAI: handleModifyWithAIFromHook
    } = usePlanModifier();

    const handleModifyWithAI = async () => {
        if (!plan) return;
        await handleModifyWithAIFromHook(plan, savePlan, agents, workflows);
    };

    const { registerAiStreamHandlers } = useAiStream();
    
    const {
        selectedTextInfo,
        setSelectedTextInfo,
        showSelectionPopup,
        setShowSelectionPopup,
        commentText,
        setCommentText,
        setEditInstruction,
        isInlineAiLoading,
        selectionPopupRef,
        handleLeaveCommentSubmit,
        handleQuickEditSubmit
    } = useInlineEdit(plan, savePlan, activeTab, planningSubTab, registerAiStreamHandlers);

    // Comment parser logic
    const rawDoc = unwrapPlanningText(plan?.designDoc || '');
    const { parsedComments: parsedDocComments, cleanText: cleanDocContent } = parseCommentsFromText(rawDoc, 'comment-doc');

    const rawPlanning = unwrapPlanningText(plan?.codePlanning || '');
    const { parsedComments: parsedPlanningComments, cleanText: cleanPlanningContent } = parseCommentsFromText(rawPlanning, 'comment-planning');

    const getTargetIdForField = (text: string) => {
        const matchedComment = parsedDocComments.find(comment => {
            const cleanContext = comment.context.trim().toLowerCase();
            return cleanContext && text.toLowerCase().includes(cleanContext);
        });
        return matchedComment ? `comment-target-${matchedComment.id}` : undefined;
    };

    const parsedComments = activeTab === 'planning'
        ? (planningSubTab === 'blueprints'
            ? parsedPlanningComments
            : (planningSubTab === 'tradeoffs'
                ? parsedDocComments.filter(comment => {
                    const cleanContext = comment.context.trim().toLowerCase();
                    return cleanContext && (plan?.planningTradeoffs || []).some(t =>
                        t.task.toLowerCase().includes(cleanContext) ||
                        t.considerations.toLowerCase().includes(cleanContext) ||
                        t.decision.toLowerCase().includes(cleanContext)
                    );
                })
                : parsedDocComments.filter(comment => {
                    const cleanContext = comment.context.trim().toLowerCase();
                    return cleanContext && (plan?.planningConsequences || []).some(c =>
                        c.failureMode.toLowerCase().includes(cleanContext) ||
                        c.consequence.toLowerCase().includes(cleanContext) ||
                        c.harm.toLowerCase().includes(cleanContext) ||
                        c.mitigation.toLowerCase().includes(cleanContext)
                    );
                })
            ))
        : (activeTab === 'tradeoffs'
            ? parsedDocComments.filter(comment => {
                const cleanContext = comment.context.trim().toLowerCase();
                return cleanContext && (plan?.tradeoffs || []).some(t =>
                    t.task.toLowerCase().includes(cleanContext) ||
                    t.considerations.toLowerCase().includes(cleanContext) ||
                    t.decision.toLowerCase().includes(cleanContext)
                );
            })
            : (activeTab === 'consequences'
                ? parsedDocComments.filter(comment => {
                    const cleanContext = comment.context.trim().toLowerCase();
                    return cleanContext && (plan?.consequences || []).some(c =>
                        c.failureMode.toLowerCase().includes(cleanContext) ||
                        c.consequence.toLowerCase().includes(cleanContext) ||
                        c.harm.toLowerCase().includes(cleanContext) ||
                        c.mitigation.toLowerCase().includes(cleanContext)
                    );
                })
                : parsedDocComments
            )
        );

    const cleanDoc = activeTab === 'planning' ? cleanPlanningContent : cleanDocContent;

    const { commentOffsets, hoveredCommentId, setHoveredCommentId, containerRef } = useCommentOffsets(
        parsedComments,
        activeTab,
        planningSubTab,
        cleanDocContent,
        cleanPlanningContent
    );

    // Derived handlers
    const handleApprovePlan = async () => {
        if (!plan) return;
        setIsExecuting(true);
        await savePlan({ ...plan, approved: true });
        window.dispatchEvent(new CustomEvent('plan-reloaded'));

        try {
            const result = await window.ipcRenderer.invoke('execution:start', taskId);
            if (!result.success) {
                console.error('Execution failed:', result.error);
            }
        } catch (err) {
            console.error('Failed to start execution:', err);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleStopExecution = () => {
        window.ipcRenderer.invoke('execution:stop', taskId);
    };

    const handleRevokeApproval = async () => {
        if (!plan) return;
        await savePlan({ ...plan, approved: false });
        window.dispatchEvent(new CustomEvent('plan-reloaded'));
    };

    const handleDetailedPlanning = async (directives?: string) => {
        if (!plan) return;
        await handleDetailedPlanningFromHook(plan, savePlan, setActiveTab, parsedPlanningComments, cleanDocContent, directives);
    };

    // Overview Tab Handlers
    const handleSaveExpectedOutcome = async () => {
        if (!plan) return;
        await savePlan({ ...plan, expectedOutcome: editingExpectedOutcomeText });
        setIsEditingExpectedOutcome(false);
    };

    const handleAddReadItem = async () => {
        if (!plan || !newReadText.trim()) return;
        const updated = [...(plan.filesRead || []), newReadText.trim()];
        await savePlan({ ...plan, filesRead: updated });
        setNewReadText('');
        setShowAddRead(false);
    };

    const handleSaveReadItem = async (index: number) => {
        if (!plan || !editingReadText.trim()) return;
        const updated = [...(plan.filesRead || [])];
        updated[index] = editingReadText.trim();
        await savePlan({ ...plan, filesRead: updated });
        setEditingReadIndex(null);
    };

    const handleDeleteReadItem = async (index: number) => {
        if (!plan) return;
        const updated = (plan.filesRead || []).filter((_, idx) => idx !== index);
        await savePlan({ ...plan, filesRead: updated });
    };

    const handleAddModifyItem = async () => {
        if (!plan || !newModifyText.trim()) return;
        const updated = [...(plan.filesToModify || []), newModifyText.trim()];
        await savePlan({ ...plan, filesToModify: updated });
        setNewModifyText('');
        setShowAddModify(false);
    };

    const handleSaveModifyItem = async (index: number) => {
        if (!plan || !editingModifyText.trim()) return;
        const updated = [...(plan.filesToModify || [])];
        updated[index] = editingModifyText.trim();
        await savePlan({ ...plan, filesToModify: updated });
        setEditingModifyIndex(null);
    };

    const handleDeleteModifyItem = async (index: number) => {
        if (!plan) return;
        const updated = (plan.filesToModify || []).filter((_, idx) => idx !== index);
        await savePlan({ ...plan, filesToModify: updated });
    };

    const handleAddCritItem = async () => {
        if (!plan || !newCritText.trim()) return;
        const updated = [...(plan.verificationCriteria || []), newCritText.trim()];
        await savePlan({ ...plan, verificationCriteria: updated });
        setNewCritText('');
        setShowAddCrit(false);
    };

    const handleSaveCritItem = async (index: number) => {
        if (!plan || !editingCritText.trim()) return;
        const updated = [...(plan.verificationCriteria || [])];
        updated[index] = editingCritText.trim();
        await savePlan({ ...plan, verificationCriteria: updated });
        setEditingCritIndex(null);
    };

    const handleDeleteCritItem = async (index: number) => {
        if (!plan) return;
        const updated = (plan.verificationCriteria || []).filter((_, idx) => idx !== index);
        await savePlan({ ...plan, verificationCriteria: updated });
    };

    // Design Doc Handlers
    const handleCopyDoc = async () => {
        try {
            await navigator.clipboard.writeText(cleanDocContent || '');
            setCopiedDoc(true);
            setTimeout(() => setCopiedDoc(false), 2000);
        } catch (err) {
            console.error('Failed to copy design doc:', err);
        }
    };

    const handleCopyPlanning = async () => {
        try {
            await navigator.clipboard.writeText(cleanPlanningContent || '');
            setCopiedPlanning(true);
            setTimeout(() => setCopiedPlanning(false), 2000);
        } catch (err) {
            console.error('Failed to copy code planning:', err);
        }
    };

    const handleDeleteComment = async (commentToDelete: { rawBlock: string }) => {
        if (!plan) return;
        if (activeTab === 'planning' && planningSubTab === 'blueprints') {
            const currentPlanning = plan.codePlanning || '';
            const newPlanning = currentPlanning.replace(commentToDelete.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
            await savePlan({ ...plan, codePlanning: newPlanning });
        } else {
            const currentDoc = plan.designDoc || '';
            const newDoc = currentDoc.replace(commentToDelete.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
            await savePlan({ ...plan, designDoc: newDoc });
        }
    };

    const handleEditComment = async (commentToEdit: { rawBlock: string; context: string }, newBody: string) => {
        if (!plan || !newBody.trim()) return;
        const targetClean = commentToEdit.context.replace(/\n/g, ' ');
        const newCommentString = `> \u{1F4AC} **Refactor Comment:** ${newBody.trim()} \u2014 *on: "${targetClean}"*`;
        if (activeTab === 'planning' && planningSubTab === 'blueprints') {
            const currentPlanning = plan.codePlanning || '';
            const newPlanning = currentPlanning.replace(commentToEdit.rawBlock, newCommentString);
            await savePlan({ ...plan, codePlanning: newPlanning });
        } else {
            const currentDoc = plan.designDoc || '';
            const newDoc = currentDoc.replace(commentToEdit.rawBlock, newCommentString);
            await savePlan({ ...plan, designDoc: newDoc });
        }
    };

    // Step Handlers
    const toggleStepCompleted = async (index: number) => {
        if (!plan) return;
        const updated = [...plan.steps];
        updated[index] = { ...updated[index], completed: !updated[index].completed };
        await savePlan({ ...plan, steps: updated });
    };

    const handleStartEdit = (index: number, step: PlanStep) => {
        setEditingStepIndex(index);
        setEditStepData({ ...step });
    };

    const handleSaveEdit = async (index: number) => {
        if (!plan || !editStepData) return;
        const updated = [...plan.steps];
        updated[index] = { ...editStepData };
        await savePlan({ ...plan, steps: updated });
        setEditingStepIndex(null);
        setEditStepData(null);
    };

    const handleSelectAgentOrWorkflow = async (index: number, selection: string) => {
        if (!plan) return;
        const updated = [...plan.steps];
        updated[index] = { ...updated[index], agent: selection || undefined };
        await savePlan({ ...plan, steps: updated });
    };

    const handleDeleteStep = async (index: number) => {
        if (!plan) return;
        const updated = plan.steps.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, order: idx + 1 }));
        await savePlan({ ...plan, steps: updated });
    };

    const handleAddStep = async () => {
        if (!plan) return;
        const newStepItem: PlanStep = {
            order: plan.steps.length + 1,
            action: 'analyze',
            target: '.',
            rationale: 'New task step details...',
            completed: false
        };
        await savePlan({ ...plan, steps: [...plan.steps, newStepItem] });
    };

    const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
        if (!plan) return;
        const updated = [...plan.steps];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= updated.length) return;
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;
        const reordered = updated.map((s, idx) => ({ ...s, order: idx + 1 }));
        await savePlan({ ...plan, steps: reordered });
    };

    useEffect(() => {
        if (activeAgentPopoverIndex === null) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.agent-popover-container') && !target.closest('.agent-badge-trigger')) {
                setActiveAgentPopoverIndex(null);
                setAgentSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [activeAgentPopoverIndex]);

    if (!plan) {
        return (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'Inter, sans-serif' }}>
                <span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: '8px' }} />
                Loading task plan...
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d1117', color: 'white', fontFamily: 'Inter, sans-serif' }}>
            <PlanApprovalBanner
                plan={plan}
                handleApprovePlan={handleApprovePlan}
                handleRevokeApproval={handleRevokeApproval}
                isExecuting={isExecuting}
                onStop={handleStopExecution}
                executionMessage={executionMessage}
            />

            <PlanNavigationTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showPlanningTab={!!plan.codePlanning}
                isDetailedPlanningLoading={isDetailedPlanningLoading}
                showPlanningInput={showPlanningInput}
                setShowPlanningInput={setShowPlanningInput}
                planningDirectives={planningDirectives}
                setPlanningDirectives={setPlanningDirectives}
                handleDetailedPlanning={handleDetailedPlanning}
            />

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0 100px 0' }}>
                {activeTab === 'overview' && (
                    <PlanOverviewTab
                        plan={plan}
                        isEditingExpectedOutcome={isEditingExpectedOutcome}
                        editingExpectedOutcomeText={editingExpectedOutcomeText}
                        setEditingExpectedOutcomeText={setEditingExpectedOutcomeText}
                        setIsEditingExpectedOutcome={setIsEditingExpectedOutcome}
                        handleSaveExpectedOutcome={handleSaveExpectedOutcome}
                        showAddRead={showAddRead}
                        setShowAddRead={setShowAddRead}
                        newReadText={newReadText}
                        setNewReadText={setNewReadText}
                        handleAddReadItem={handleAddReadItem}
                        editingReadIndex={editingReadIndex}
                        editingReadText={editingReadText}
                        setEditingReadText={setEditingReadText}
                        setEditingReadIndex={setEditingReadIndex}
                        handleSaveReadItem={handleSaveReadItem}
                        handleDeleteReadItem={handleDeleteReadItem}
                        showAddModify={showAddModify}
                        setShowAddModify={setShowAddModify}
                        newModifyText={newModifyText}
                        setNewModifyText={setNewModifyText}
                        handleAddModifyItem={handleAddModifyItem}
                        editingModifyIndex={editingModifyIndex}
                        editingModifyText={editingModifyText}
                        setEditingModifyText={setEditingModifyText}
                        setEditingModifyIndex={setEditingModifyIndex}
                        handleSaveModifyItem={handleSaveModifyItem}
                        handleDeleteModifyItem={handleDeleteModifyItem}
                        showAddCrit={showAddCrit}
                        setShowAddCrit={setShowAddCrit}
                        newCritText={newCritText}
                        setNewCritText={setNewCritText}
                        handleAddCritItem={handleAddCritItem}
                        editingCritIndex={editingCritIndex}
                        editingCritText={editingCritText}
                        setEditingCritText={setEditingCritText}
                        setEditingCritIndex={setEditingCritIndex}
                        handleSaveCritItem={handleSaveCritItem}
                        handleDeleteCritItem={handleDeleteCritItem}
                    />
                )}

                {activeTab === 'steps' && (
                    <PlanStepsTab
                        plan={plan}
                        editingStepIndex={editingStepIndex}
                        editStepData={editStepData}
                        setEditingStepIndex={setEditingStepIndex}
                        setEditStepData={setEditStepData}
                        agents={agents}
                        workflows={workflows}
                        activeAgentPopoverIndex={activeAgentPopoverIndex}
                        setActiveAgentPopoverIndex={setActiveAgentPopoverIndex}
                        agentSearchQuery={agentSearchQuery}
                        setAgentSearchQuery={setAgentSearchQuery}
                        toggleStepCompleted={toggleStepCompleted}
                        handleStartEdit={handleStartEdit}
                        handleSaveEdit={handleSaveEdit}
                        handleSelectAgentOrWorkflow={handleSelectAgentOrWorkflow}
                        handleDeleteStep={handleDeleteStep}
                        handleAddStep={handleAddStep}
                        handleMoveStep={handleMoveStep}
                    />
                )}

                {activeTab === 'doc' && (
                    <PlanDocTab
                        plan={plan}
                        savePlan={savePlan}
                        containerRef={containerRef}
                        cleanDoc={cleanDoc}
                        parsedDocComments={parsedDocComments}
                        parsedComments={parsedComments}
                        commentOffsets={commentOffsets}
                        hoveredCommentId={hoveredCommentId}
                        setHoveredCommentId={setHoveredCommentId}
                        editingCommentId={editingCommentId}
                        setEditingCommentId={setEditingCommentId}
                        editingCommentBody={editingCommentBody}
                        setEditingCommentBody={setEditingCommentBody}
                        handleEditComment={handleEditComment}
                        handleDeleteComment={handleDeleteComment}
                        handleCopyDoc={handleCopyDoc}
                        copiedDoc={copiedDoc}
                        showAddDocComment={showAddDocComment}
                        setShowAddDocComment={setShowAddDocComment}
                        newDocComment={newDocComment}
                        setNewDocComment={setNewDocComment}
                        selectedTextInfo={selectedTextInfo}
                    />
                )}

                {(activeTab === 'planning' || activeTab === 'tradeoffs' || activeTab === 'consequences') && (
                    <PlanPlanningTab
                        plan={plan}
                        savePlan={savePlan}
                        setPlan={setPlan}
                        containerRef={containerRef}
                        activeTab={activeTab}
                        planningSubTab={planningSubTab}
                        setPlanningSubTab={setPlanningSubTab}
                        isDetailedPlanningLoading={isDetailedPlanningLoading}
                        planningDirectives={planningDirectives}
                        setPlanningDirectives={setPlanningDirectives}
                        handleDetailedPlanning={handleDetailedPlanning}
                        cleanPlanning={cleanPlanningContent}
                        parsedComments={parsedComments}
                        parsedPlanningComments={parsedPlanningComments}
                        commentOffsets={commentOffsets}
                        hoveredCommentId={hoveredCommentId}
                        setHoveredCommentId={setHoveredCommentId}
                        editingCommentId={editingCommentId}
                        setEditingCommentId={setEditingCommentId}
                        editingCommentBody={editingCommentBody}
                        setEditingCommentBody={setEditingCommentBody}
                        handleEditComment={handleEditComment}
                        handleDeleteComment={handleDeleteComment}
                        handleCopyPlanning={handleCopyPlanning}
                        copiedPlanning={copiedPlanning}
                        showAddPlanningComment={showAddPlanningComment}
                        setShowAddPlanningComment={setShowAddPlanningComment}
                        newPlanningComment={newPlanningComment}
                        setNewPlanningComment={setNewPlanningComment}
                        handleTextareaSelect={handleTextareaSelect}
                        handleTextareaMouseUp={handleTextareaMouseUp}
                        getTargetIdForField={getTargetIdForField}
                        selectedTextInfo={selectedTextInfo}
                    />
                )}

                {activeTab === 'flow' && (
                    <PlanFlowTab
                        plan={plan}
                        hoveredNode={hoveredNode}
                        setHoveredNode={setHoveredNode}
                    />
                )}
            </div>

            <PlanAiModifyBar
                aiInstructions={aiInstructions}
                setAiInstructions={setAiInstructions}
                isAiLoading={isAiLoading}
                handleModifyWithAI={handleModifyWithAI}
                inlineAiError={inlineAiError}
                show={activeTab === 'doc' || activeTab === 'steps'}
            />

            <PlanSelectionPopup
                selectedTextInfo={selectedTextInfo}
                showSelectionPopup={showSelectionPopup}
                selectionPopupRef={selectionPopupRef}
                commentText={commentText}
                setCommentText={setCommentText}
                setEditInstruction={setEditInstruction}
                handleLeaveCommentSubmit={handleLeaveCommentSubmit}
                handleQuickEditSubmit={handleQuickEditSubmit}
                isInlineAiLoading={isInlineAiLoading}
                setSelectedTextInfo={setSelectedTextInfo}
                setShowSelectionPopup={setShowSelectionPopup}
            />
        </div>
    );
}