import { useState, useEffect } from 'react';
import { unwrapPlanningText } from '../utils/jsonParser';
import type { ExecutionPlan, ActiveTab } from '../helpers/planEditorTypes';
import { useAiStream } from './useAiStream';

// eslint-disable-next-line max-lines-per-function
export function useDetailedPlanning() {
    const { registerAiStreamHandlers } = useAiStream();
    const [isDetailedPlanningLoading, setIsDetailedPlanningLoading] = useState(false);
    const [showPlanningInput, setShowPlanningInput] = useState(false);
    const [planningDirectives, setPlanningDirectives] = useState('');

    useEffect(() => {
        if (!showPlanningInput) return;
        const handleOutsidePlanningClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.planning-popover-container') && !target.closest('.planning-trigger-btn')) {
                setShowPlanningInput(false);
            }
        };
        document.addEventListener('mousedown', handleOutsidePlanningClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsidePlanningClick);
        };
    }, [showPlanningInput]);

    // eslint-disable-next-line max-lines-per-function
    const handleDetailedPlanning = async (
        plan: ExecutionPlan,
        savePlan: (p: ExecutionPlan) => Promise<void>,
        setActiveTab: (v: ActiveTab) => void,
        parsedPlanningComments: { id: string; body: string; context: string; rawBlock: string }[],
        cleanDoc: string,
        directives?: string
    ) => {
        if (!plan) return;
        setIsDetailedPlanningLoading(true);

        window.dispatchEvent(new CustomEvent('plan:modify-started', {
            detail: { instructions: directives && directives.trim()
                ? `Generating detailed code blueprints (Directives: "${directives.trim()}")`
                : 'Generating detailed code blueprints and specifications for current roadmap steps.' }
        }));

        const systemPrompt = `You are an expert system architect and software engineer. Your task is to:
1. Write extremely detailed design specifications, production-ready code drafts/blueprints, and architectural explanations for each of the files we are modifying or creating in the roadmap. Think like a Chief Software Architect: explain the integration points, class structures, method signatures, data flow logic, and edge cases. Every code snippet must be fully written out and functional — do NOT use placeholders, abbreviated code blocks, or generic '// TODO' comments.
2. Formulate a dependency mapping of the classes, modules, services, and interfaces involved in these modifications and creations.
3. Conduct a highly thorough, detailed evaluation of the implementation-level trade-offs for the specific code being written. These tradeoffs are ONE LEVEL DEEPER than the design document tradeoffs above — they take those architectural decisions as given constraints and figure out the best way to implement them in code. Focus on concrete implementation details:
   - Why a class vs a module of utility functions vs a single function
   - Whether to use decorators, why or why not, and what alternative patterns were considered
   - Algorithmic complexity: why O(n) vs O(log n) vs O(1) — analyze real access patterns and data sizes
   - Data structure choices: why a Map vs plain object vs array vs Set vs tuple — compare look-up speed, memory overhead, iteration cost
   - Why a specific design pattern (Factory, Builder, Strategy, etc.) vs simpler alternatives
   - Why a typed tuple vs an interface vs separate parameters — evaluate type safety, readability, and extensibility
   - Sync vs async vs streaming — analyze actual call paths and concurrency needs
   - Error handling strategy: Result types vs try/catch vs sentinel values vs option types
   - Dependency injection approach: constructor injection vs service locator vs parameter passing
   - Why a specific sort, filter, or reduce approach over alternatives
   Compare at least 2 alternatives per tradeoff, with real pros/cons, and justify the final decision.
4. Conduct a thorough risk and consequence analysis for the implementation choices above — NOT high-level architectural risks. Focus on what could go wrong at the code level:
   - Off-by-one errors, race conditions from shared mutable state, null dereference, type confusion
   - Memory leaks from unclosed subscriptions, listeners, or file handles
   - Performance cliffs: O(n^2) hidden inside loops, unnecessary re-renders, redundant recomputation
   - Incorrect error propagation masking bugs or causing silent data corruption
   - Thread-unsafe patterns in concurrent code, deadlocks, starvation
   - Over-engineering: unnecessary abstraction layers, premature optimization, over-normalization

You MUST respond ONLY with a single JSON object. Do NOT wrap the JSON in Markdown code fences; return the raw JSON string directly.
The JSON object must strictly match this structure:
{
  "designDoc": "Detailed design specifications, actual code drafts, and explanation of modifications in Markdown format",
  "classDependencies": [
    {
      "name": "Class/Module/Interface Name",
      "type": "class | module | service | interface",
      "dependsOn": ["Names of other classes/modules/interfaces it depends on/calls/uses"],
      "description": "Brief 1-2 sentence description of its responsibility and relationships"
    }
  ],
  "tradeoffs": [
    {
      "task": "Implementation decision analyzed (e.g., 'Binary search O(log n) vs linear scan O(n)', 'Class with decorators vs plain functions', 'Map<string, Handler> vs switch statement', 'Builder pattern vs constructor with 8 params')",
      "considerations": "Compare alternatives: algorithmic complexity, memory usage, type safety, readability, testability, extensibility. Include real code access patterns and data sizes.",
      "decision": "Chosen implementation approach and concrete justification with performance/memory/safety reasoning"
    }
  ],
  "consequences": [
    {
      "failureMode": "Code-level failure mode (e.g., 'Unbounded mutable shared state causes race condition', 'Unclosed event listener leaks memory on unmount', 'Hidden O(n^2) in nested reduce calls')",
      "consequence": "Runtime impact: crash, data corruption, performance degradation, incorrect output",
      "harm": "Debugging cost, production incident severity, user-visible latency or data loss",
      "mitigation": "Specific code guard: immutability enforcement, disposer pattern, early exit, WeakRef, or test assertion"
    }
  ]
}
Ensure the JSON is strictly valid, and strings inside are properly escaped.`;

        let userPrompt = `Roadmap Steps:
${plan.steps.map((s) => `- Step ${s.order} [${s.action} ${s.target}]: ${s.rationale}`).join('\n')}

Expected Outcome:
${plan.expectedOutcome}

Files to Modify:
${plan.filesToModify.join('\n')}

Files to Create:
${plan.steps.filter((s) => s.action === 'create').map((s) => s.target).join('\n')}

Existing Design Document (includes high-level tradeoffs and consequences to consider):
${cleanDoc}

IMPORTANT: The "tradeoffs" and "consequences" you generate here are for the IMPLEMENTATION level — they are derived from the design document above, taking its decisions as constraints, and focus on how to implement those decisions in actual code (algorithms, data structures, patterns, error handling, etc.).`;

        if (directives && directives.trim()) {
            userPrompt += `\n\nUser Custom Planning Directives/Constraints to respect:\n${directives.trim()}`;
        }

        // eslint-disable-next-line max-lines-per-function, complexity
        const handleEnd = async (payload?: { plan?: any; error?: string; aborted?: boolean }) => {
            setIsDetailedPlanningLoading(false);

            if (payload && payload.plan) {
                const parsed = payload.plan;
                let parsedDesignDoc = unwrapPlanningText(parsed.designDoc);
                let parsedClassDeps = Array.isArray(parsed.classDependencies) ? parsed.classDependencies : [];
                let parsedTradeoffs = Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [];
                let parsedConsequences = Array.isArray(parsed.consequences) ? parsed.consequences : [];

                if (parsedDesignDoc) {
                    const commentsString = parsedPlanningComments.map(c => c.rawBlock).join('\n');
                    const finalDoc = parsedDesignDoc + (commentsString ? '\n\n' + commentsString : '');

                    const mergedPlanningTradeoffs = [
                        ...(plan.planningTradeoffs || []),
                        ...parsedTradeoffs
                    ];
                    const mergedPlanningConsequences = [
                        ...(plan.planningConsequences || []),
                        ...parsedConsequences
                    ];

                    await savePlan({
                        ...plan,
                        codePlanning: finalDoc,
                        classDependencies: parsedClassDeps.length > 0 ? (parsedClassDeps as ExecutionPlan['classDependencies']) : undefined,
                        planningTradeoffs: mergedPlanningTradeoffs.length > 0 ? (mergedPlanningTradeoffs as ExecutionPlan['planningTradeoffs']) : plan.planningTradeoffs,
                        planningConsequences: mergedPlanningConsequences.length > 0 ? (mergedPlanningConsequences as ExecutionPlan['planningConsequences']) : plan.planningConsequences
                    });
                    setActiveTab('planning');

                    window.dispatchEvent(new CustomEvent('plan:modify-ended', {
                        detail: {
                            success: true,
                            description: 'Detailed planning completed. Code blueprints, specifications, and class dependencies generated.'
                        }
                    }));
                } else {
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
        }, handleEnd, 'ai:detailed-plan');

        window.ipcRenderer.send('ai:detailed-plan-start', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            convId: '__detailed_plan__'
        });
    };

    return {
        isDetailedPlanningLoading,
        showPlanningInput,
        setShowPlanningInput,
        planningDirectives,
        setPlanningDirectives,
        handleDetailedPlanning
    };
}
