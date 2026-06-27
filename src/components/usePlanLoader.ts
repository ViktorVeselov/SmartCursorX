import { useState, useEffect, useCallback } from 'react';
import { cleanAndExtractJSONObjects, mergeExecutionPlans } from '../utils/jsonParser';
import type { ExecutionPlan } from '../helpers/planEditorTypes';

function extractSection(markdown: string, keywordRegex: RegExp): string {
    const lines = markdown.split('\n');
    let inSection = false;
    const sectionLines: string[] = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            if (keywordRegex.test(trimmed)) {
                inSection = true;
            } else if (inSection) {
                break;
            }
        } else if (inSection) {
            sectionLines.push(line);
        }
    }
    return sectionLines.join('\n');
}

function parseTradeoffsFromMarkdown(markdown: string) {
    const tradeoffs: { task: string; considerations: string; decision: string }[] = [];
    const section = extractSection(markdown, /trade-?offs?/i);
    const tradeoffRegex = /(?:\*\*|\*|)?(?:Task|Option)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)([\s\S]*?)(?:\*\*|\*|)?(?:Decision)(?:\*\*|\*|)?:\s*(.+?)(?=\r?\n\r?\n|\r?\n(?:\*\*|\*|)?(?:Task|Option):|\s*$)/gi;
    
    let match;
    while ((match = tradeoffRegex.exec(section)) !== null) {
        const task = match[1].trim();
        const considerationsRaw = match[2].trim();
        const decision = match[3].trim();
        const considerations = considerationsRaw
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join(' | ');
        tradeoffs.push({ task, considerations, decision });
    }
    return tradeoffs;
}

function parseConsequencesFromMarkdown(markdown: string) {
    const consequences: { failureMode: string; consequence: string; harm: string; mitigation: string }[] = [];
    const section = extractSection(markdown, /consequences?|failure/i);
    const consequenceRegex = /(?:\*\*|\*|)?(?:Failure Mode|Risk)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)(?:[\s\S]*?)(?:\*\*|\*|)?(?:Consequence)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)(?:[\s\S]*?)(?:\*\*|\*|)?(?:Harm)(?:\*\*|\*|)?:\s*(.+?)(?:\r?\n)(?:[\s\S]*?)(?:\*\*|\*|)?(?:Mitigation)(?:\*\*|\*|)?:\s*(.+?)(?=\r?\n\r?\n|\r?\n(?:\*\*|\*|)?(?:Failure Mode|Risk):|\s*$)/gi;

    let match;
    while ((match = consequenceRegex.exec(section)) !== null) {
        const failureMode = match[1].trim();
        const consequence = match[2].trim();
        const harm = match[3].trim();
        const mitigation = match[4].trim();
        consequences.push({ failureMode, consequence, harm, mitigation });
    }
    return consequences;
}

function stripSectionsFromMarkdown(markdown: string): string {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    const cleanLines: string[] = [];
    let skipping = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            if (/trade-?offs?|consequences?|failure/i.test(trimmed)) {
                skipping = true;
            } else {
                skipping = false;
            }
        }
        if (!skipping) {
            cleanLines.push(line);
        }
    }
    return cleanLines.join('\n').trim();
}

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
                let planTradeoffs = (parsed.tradeoffs || []).map(t => ({
                    task: t.task || "",
                    considerations: t.considerations || "",
                    decision: t.decision || ""
                }));
                const emptyTradeoffs = planTradeoffs.filter(t => !t.task && !t.considerations && !t.decision);
                if (planTradeoffs.length === 0 || emptyTradeoffs.length === planTradeoffs.length) {
                    if (parsed.designDoc) {
                        const parsedTradeoffs = parseTradeoffsFromMarkdown(parsed.designDoc);
                        if (parsedTradeoffs.length > 0) {
                            planTradeoffs = parsedTradeoffs;
                        }
                    }
                }

                let planConsequences = (parsed.consequences || []).map(c => ({
                    failureMode: c.failureMode || "",
                    consequence: c.consequence || "",
                    harm: c.harm || "",
                    mitigation: c.mitigation || ""
                }));
                const emptyConsequences = planConsequences.filter(c => !c.failureMode && !c.consequence && !c.harm && !c.mitigation);
                if (planConsequences.length === 0 || emptyConsequences.length === planConsequences.length) {
                    if (parsed.designDoc) {
                        const parsedConsequences = parseConsequencesFromMarkdown(parsed.designDoc);
                        if (parsedConsequences.length > 0) {
                            planConsequences = parsedConsequences;
                        }
                    }
                }

                const missingStepFields = planSteps.filter(s => s.target === "." && s.rationale === "Review and analyze");
                if (missingStepFields.length > 0) {
                    console.warn(`[PlanEditor] Loaded plan has ${missingStepFields.length} step(s) using defaults (no real data)`);
                }
                const checkEmptyTradeoffs = planTradeoffs.filter(t => !t.task && !t.considerations && !t.decision);
                if (planTradeoffs.length > 0 && checkEmptyTradeoffs.length === planTradeoffs.length) {
                    console.warn("[PlanEditor] Loaded plan has tradeoffs but all fields are empty");
                }
                const checkEmptyConsequences = planConsequences.filter(c => !c.failureMode && !c.consequence && !c.harm && !c.mitigation);
                if (planConsequences.length > 0 && checkEmptyConsequences.length === planConsequences.length) {
                    console.warn("[PlanEditor] Loaded plan has consequences but all fields are empty");
                }
                setPlan({
                    ...parsed,
                    steps: planSteps,
                    tradeoffs: planTradeoffs,
                    consequences: planConsequences,
                    designDoc: parsed.designDoc ? stripSectionsFromMarkdown(parsed.designDoc) : parsed.designDoc
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
                    filesToCreate: [],
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
