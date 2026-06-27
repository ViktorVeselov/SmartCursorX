import { useState } from 'react';
import type { ExecutionPlan } from '../helpers/planEditorTypes';
import { useAiStream } from './useAiStream';

// eslint-disable-next-line max-lines-per-function
export function usePlanModifier() {
    const { registerAiStreamHandlers } = useAiStream();
    const [aiInstructions, setAiInstructions] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [inlineAiError, setInlineAiError] = useState<string | null>(null);

    // eslint-disable-next-line max-lines-per-function
    const handleModifyWithAI = async (
        plan: ExecutionPlan,
        savePlan: (p: ExecutionPlan) => Promise<void>,
        agents: { id: number; name: string }[],
        workflows: { id: number; name: string; description?: string }[]
    ) => {
        if (!aiInstructions.trim()) return;
        setIsAiLoading(true);
        const currentInstructions = aiInstructions.trim();

        window.dispatchEvent(new CustomEvent('plan:modify-started', {
            detail: { instructions: currentInstructions }
        }));

        const agentsList = agents.map(a => a.name).join(', ');
        const workflowsList = workflows.map(w => w.name).join(', ');
        const assignInstructions = (agentsList || workflowsList)
            ? `- For each step's "agent" field, please assign the most appropriate agent or workflow from: agents: [${agentsList || 'None'}], workflows: [${workflowsList || 'None'}]. For example, if a step involves modifying or creating code, you should assign "Code Changes" (or another relevant workflow/agent). If no existing agents or workflows are appropriate for the step, leave the "agent" field empty/blank. Do NOT invent new agent/workflow names.`
            : `- Do NOT assign any agent to step "agent" fields (leave "agent" empty or omit it) as no agents or workflows are currently defined in the system.`;

        const systemPrompt = `You are an expert system architect. You are given an execution plan in JSON format and developer instructions.
- If the instructions ask to modify or update the existing plan, apply the modifications and output the updated plan.
- To prevent data loss and save tokens, do NOT rewrite unchanged sections. If the developer's instructions only target the roadmap steps, preserve the existing 'designDoc', 'expectedOutcome', 'filesRead', 'filesToModify', 'filesToCreate', 'verificationCriteria', 'tradeoffs', and 'consequences' exactly as they are. If the instructions target only a specific component or section, focus only on updating that relevant part and output the rest of the fields identical to the input.
- If the instructions ask to create a new plan, regenerate the plan, or start from scratch, discard the existing plan and generate a completely new execution plan from scratch based on the developer instructions.
${assignInstructions}
IMPORTANT: Every single field in the JSON output MUST be populated with meaningful content. Do NOT leave any field as an empty string, empty array, or placeholder. If you do not have specific content for a field, generate reasonable default content based on the context. Every step must have a non-empty action, target, and rationale. Every trade-off must have a non-empty task, considerations, and decision. Every consequence must have a non-empty failureMode, consequence, harm, and mitigation.
Output ONLY a single valid JSON object containing the plan. Do NOT include any explanations, markdown code blocks (like \`\`\`json), or text before/after the JSON.
Format:
{
  "steps": [
    {
      "order": 1,
      "action": "create" | "modify" | "read" | "delete" | "run_command",
      "target": "path/to/file",
      "rationale": "Reason/rationale",
      "notes": "Additional notes (optional)",
      "agent": "Name of agent or workflow (optional)"
    }
  ],
  "expectedOutcome": "...",
  "filesRead": [],
  "filesToModify": [],
  "filesToCreate": [],
  "verificationCriteria": [],
  "designDoc": "Markdown formatted detailed text / design specs (optional)",
  "tradeoffs": [
    {
      "task": "Internal evaluation task or choice analyzed",
      "considerations": "Key pros, cons, complexity, or security trade-offs considered",
      "decision": "Final decision made and why it was selected"
    }
  ],
  "consequences": [
    {
      "failureMode": "Part of the plan/implementation that fails or is incorrect",
      "consequence": "What can/will go wrong (e.g. key exposure, security vulnerability, data loss)",
      "harm": "How this failure harms the user, system, or company",
      "mitigation": "How this plan or implementation mitigates or guards against this risk"
    }
  ]
}`;

        const userPrompt = `Current Plan JSON:
${JSON.stringify(plan)}

Developer Instructions:
${aiInstructions}

Note: If the instructions ask to start from scratch, regenerate, or create a new plan, ignore the Current Plan JSON.`;

        // eslint-disable-next-line complexity
        const handleEnd = async (payload?: { plan?: any; error?: string; aborted?: boolean }) => {
            setIsAiLoading(false);
            setAiInstructions('');

            if (payload && payload.plan) {
                try {
                    const parsed = payload.plan;
                    const normalizedSteps = (parsed.steps || []).map((s: any, i: number) => ({
                        order: s.order || i + 1,
                        action: s.action || "analyze",
                        target: s.target || ".",
                        rationale: s.rationale || "Review and analyze",
                        completed: !!s.completed,
                        notes: s.notes || undefined,
                        agent: s.agent || undefined
                    }));
                    const normalizedTradeoffs = (parsed.tradeoffs || []).map((t: any) => ({
                        task: t.task || "",
                        considerations: t.considerations || "",
                        decision: t.decision || ""
                    }));
                    const normalizedConsequences = (parsed.consequences || []).map((c: any) => ({
                        failureMode: c.failureMode || "",
                        consequence: c.consequence || "",
                        harm: c.harm || "",
                        mitigation: c.mitigation || ""
                    }));

                    const updatedPlan = {
                        ...parsed,
                        steps: normalizedSteps,
                        tradeoffs: normalizedTradeoffs.length > 0 ? normalizedTradeoffs : parsed.tradeoffs,
                        consequences: normalizedConsequences.length > 0 ? normalizedConsequences : parsed.consequences,
                        approved: !!plan?.approved
                    };

                    await savePlan(updatedPlan);

                    window.dispatchEvent(new CustomEvent('plan:modify-ended', {
                        detail: {
                            success: true,
                            description: `Updated execution roadmap and design spec based on: "${currentInstructions}"`
                        }
                    }));
                } catch (err) {
                    console.error('Failed to parse AI modified plan:', err);
                    setInlineAiError('AI returned invalid plan JSON. Try a clearer rewrite request.');
                    setTimeout(() => setInlineAiError(null), 5000);
                    window.dispatchEvent(new CustomEvent('plan:modify-ended', {
                        detail: {
                            success: false,
                            errorMessage: 'The model did not return valid plan JSON.'
                        }
                    }));
                }
            } else {
                window.dispatchEvent(new CustomEvent('plan:modify-ended', {
                    detail: {
                        success: false,
                        errorMessage: payload?.error || 'The model did not return valid plan JSON.'
                    }
                }));
            }
        };

        registerAiStreamHandlers((_, payload) => {
            if (payload && payload.chunk) {
                // chunk received
            }
        }, handleEnd, 'ai:modify-plan');

        window.ipcRenderer.send('ai:modify-plan-start', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            convId: '__modify_plan__'
        });
    };

    return {
        aiInstructions,
        setAiInstructions,
        isAiLoading,
        inlineAiError,
        setInlineAiError,
        handleModifyWithAI
    };
}
