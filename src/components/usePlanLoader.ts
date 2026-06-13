import { useState, useEffect, useCallback } from 'react';
import { cleanAndExtractJSONObjects, mergeExecutionPlans } from '../utils/jsonParser';
import type { ExecutionPlan } from '../helpers/planEditorTypes';

// eslint-disable-next-line max-lines-per-function
export function usePlanLoader(taskId: number) {
    const [plan, setPlan] = useState<ExecutionPlan | null>(null);
    const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
    const [workflows, setWorkflows] = useState<{ id: number; name: string; description?: string }[]>([]);

    // eslint-disable-next-line complexity
    const loadPlan = useCallback(async () => {
        try {
            const res = await window.ipcRenderer.invoke('plan:get', taskId);
            if (res && res.plan_json) {
                let parsed: ExecutionPlan;
                try {
                    parsed = JSON.parse(res.plan_json) as ExecutionPlan;
                } catch (parseErr) {
                    const parsedObjects = cleanAndExtractJSONObjects(res.plan_json);
                    if (parsedObjects.length > 0) {
                        parsed = mergeExecutionPlans(parsedObjects) as unknown as ExecutionPlan;
                    } else {
                        throw parseErr;
                    }
                }
                const planSteps = (parsed.steps || []).map((s, i) => ({
                    order: s.order || i + 1,
                    action: s.action || "analyze",
                    target: s.target || ".",
                    rationale: s.rationale || "Review and analyze",
                    completed: !!s.completed
                }));
                const planTradeoffs = (parsed.tradeoffs || []).map(t => ({
                    task: t.task || "",
                    considerations: t.considerations || "",
                    decision: t.decision || ""
                }));
                const planConsequences = (parsed.consequences || []).map(c => ({
                    failureMode: c.failureMode || "",
                    consequence: c.consequence || "",
                    harm: c.harm || "",
                    mitigation: c.mitigation || ""
                }));
                const missingStepFields = planSteps.filter(s => s.target === "." && s.rationale === "Review and analyze");
                if (missingStepFields.length > 0) {
                    console.warn(`[PlanEditor] Loaded plan has ${missingStepFields.length} step(s) using defaults (no real data)`);
                }
                const emptyTradeoffs = planTradeoffs.filter(t => !t.task && !t.considerations && !t.decision);
                if (planTradeoffs.length > 0 && emptyTradeoffs.length === planTradeoffs.length) {
                    console.warn("[PlanEditor] Loaded plan has tradeoffs but all fields are empty");
                }
                const emptyConsequences = planConsequences.filter(c => !c.failureMode && !c.consequence && !c.harm && !c.mitigation);
                if (planConsequences.length > 0 && emptyConsequences.length === planConsequences.length) {
                    console.warn("[PlanEditor] Loaded plan has consequences but all fields are empty");
                }
                setPlan({
                    ...parsed,
                    steps: planSteps,
                    tradeoffs: planTradeoffs.length > 0 ? planTradeoffs : parsed.tradeoffs,
                    consequences: planConsequences.length > 0 ? planConsequences : parsed.consequences
                });
            } else {
                setPlan({
                    taskId,
                    steps: [
                        { order: 1, action: 'analyze', target: '.', rationale: 'Analyze repository context and structure', completed: false }
                    ],
                    expectedOutcome: 'Task completed successfully',
                    filesRead: [],
                    filesToModify: [],
                    verificationCriteria: ['No compilation errors'],
                    confidence: 0.9,
                    designDoc: '# Implementation Design Doc\n\nDescribe your architectural blueprint, module configurations, and code modifications here.'
                });
            }
        } catch (e) {
            console.error('Failed to load task plan:', e);
        }
    }, [taskId]);

    const savePlan = async (updatedPlan: ExecutionPlan) => {
        try {
            await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(updatedPlan));
            setPlan(updatedPlan);
        } catch (e) {
            console.error('Failed to save plan:', e);
        }
    };

    const loadAgents = async () => {
        try {
            const list = await window.ipcRenderer.invoke('db-get-agents');
            setAgents(list || []);
        } catch (e) {
            console.error('Failed to load agents:', e);
        }
        try {
            const flows = await window.ipcRenderer.invoke('db-get-flows');
            setWorkflows(flows || []);
        } catch (e) {
            console.error('Failed to load workflows:', e);
        }
    };

    useEffect(() => {
        loadPlan();
        loadAgents();
    }, [loadPlan]);

    useEffect(() => {
        const handlePlanReloaded = () => {
            loadPlan();
        };
        window.addEventListener('plan-reloaded', handlePlanReloaded);
        return () => {
            window.removeEventListener('plan-reloaded', handlePlanReloaded);
        };
    }, [loadPlan]);

    return { plan, setPlan, savePlan, agents, workflows, setAgents };
}
