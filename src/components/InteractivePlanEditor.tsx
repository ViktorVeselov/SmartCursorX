import { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cleanAndExtractJSONObjects, mergeExecutionPlans } from '../utils/jsonParser';

const COMMENT_EMOJI_PATTERN = '(?:\\u{1F4AC}|ðŸ’¬)';
const COMMENT_DASH_PATTERN = '(?:\\u2014|â€”)';
const COMMENT_LINE_REGEX = new RegExp(
    `^>\\s*${COMMENT_EMOJI_PATTERN}\\s*\\*\\*Refactor Comment:\\*\\*\\s*(.*?)\\s*${COMMENT_DASH_PATTERN}\\s*\\*on:\\s*"([\\s\\S]*?)"\\*`,
    'u'
);

// Helper function to find a plaintext match in styled Markdown content
function findMarkdownSubstring(markdown: string, plaintext: string): { start: number; end: number; matchText: string } | null {
    const cleanText = plaintext.trim().replace(/\s+/g, ' ');
    if (!cleanText) return null;

    // Escape regex symbols
    const escapeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const words = cleanText.split(' ').filter(Boolean);
    if (words.length === 0) return null;

    // Allow markdown format markers between words
    const spacer = '[\\s\\*#_`\\[\\]\\(\\)-]*';
    const regexStr = words.map(escapeRegex).join(spacer);

    try {
        const regex = new RegExp(regexStr, 'i');
        const match = markdown.match(regex);
        if (match && match.index !== undefined) {
            return {
                start: match.index,
                end: match.index + match[0].length,
                matchText: match[0]
            };
        }
    } catch (e) {
        console.error('Failed to compile markdown search regex:', e);
    }

    // Fallback: exact match
    const idx = markdown.indexOf(plaintext);
    if (idx !== -1) {
        return { start: idx, end: idx + plaintext.length, matchText: plaintext };
    }

    return null;
}

function unwrapPlanningText(value: unknown, depth = 0): string {
    if (value == null) return '';

    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return '';

        if (depth < 4) {
            const decodedVariants = [text, text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')];
            for (const candidate of decodedVariants) {
                try {
                    const parsed = JSON.parse(candidate);
                    if (typeof parsed === 'string') {
                        return unwrapPlanningText(parsed, depth + 1);
                    }
                    if (parsed && typeof parsed === 'object') {
                        const record = parsed as Record<string, unknown>;
                        for (const key of ['designDoc', 'codePlanning', 'markdown', 'content', 'text', 'body', 'description']) {
                            if (record[key] !== undefined) {
                                const extracted = unwrapPlanningText(record[key], depth + 1);
                                if (extracted) return extracted;
                            }
                        }
                        const stringValues = Object.values(record).filter((v): v is string => typeof v === 'string');
                        if (stringValues.length === 1) {
                            const extracted = unwrapPlanningText(stringValues[0], depth + 1);
                            if (extracted) return extracted;
                        }
                    }
                } catch {
                    // Not JSON; keep trying fallbacks.
                }
            }
        }

        if (text.includes('\\n') || text.includes('\\t') || text.includes('\\"')) {
            return text
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"');
        }
        return text;
    }

    if (Array.isArray(value)) {
        return value
            .map(v => unwrapPlanningText(v, depth + 1))
            .filter(Boolean)
            .join('\n\n');
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['designDoc', 'codePlanning', 'markdown', 'content', 'text', 'body', 'description']) {
            if (record[key] !== undefined) {
                const extracted = unwrapPlanningText(record[key], depth + 1);
                if (extracted) return extracted;
            }
        }

        const values = Object.values(record);
        if (values.length === 1) {
            return unwrapPlanningText(values[0], depth + 1);
        }
    }

    return '';
}

interface PlanStep {
    order: number;
    action: 'read' | 'analyze' | 'modify' | 'create' | 'delete' | 'run_command';
    target: string;
    rationale: string;
    completed?: boolean;
    agent?: string;
    notes?: string;
}

interface ExecutionPlan {
    taskId: number;
    steps: PlanStep[];
    expectedOutcome: string;
    filesRead: string[];
    filesToModify: string[];
    verificationCriteria: string[];
    confidence: number;
    designDoc?: string;
    codePlanning?: string;
    approved?: boolean;
    classDependencies?: {
        name: string;
        type: string;
        dependsOn: string[];
        description: string;
    }[];
    tradeoffs?: {
        task: string;
        considerations: string;
        decision: string;
    }[];
    consequences?: {
        failureMode: string;
        consequence: string;
        harm: string;
        mitigation: string;
    }[];
    planningTradeoffs?: {
        task: string;
        considerations: string;
        decision: string;
    }[];
    planningConsequences?: {
        failureMode: string;
        consequence: string;
        harm: string;
        mitigation: string;
    }[];
}

interface InteractivePlanEditorProps {
    taskId: number;
}

export function InteractivePlanEditor({ taskId }: InteractivePlanEditorProps) {
    const [plan, setPlan] = useState<ExecutionPlan | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'flow' | 'doc' | 'planning' | 'tradeoffs' | 'consequences'>('doc');
    const [planningSubTab, setPlanningSubTab] = useState<'blueprints' | 'tradeoffs' | 'consequences'>('blueprints');
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [editStepData, setEditStepData] = useState<PlanStep | null>(null);
    const [agents, setAgents] = useState<{ id: number; name: string }[]>([]);
    const [aiInstructions, setAiInstructions] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

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



    // Design Doc states
    const [copiedDoc, setCopiedDoc] = useState(false);
    const [showAddDocComment, setShowAddDocComment] = useState(false);
    const [newDocComment, setNewDocComment] = useState('');

    const [copiedPlanning, setCopiedPlanning] = useState(false);
    const [showAddPlanningComment, setShowAddPlanningComment] = useState(false);
    const [newPlanningComment, setNewPlanningComment] = useState('');

    const activeChunkListenerRef = useRef<((_: any, chunk: string) => void) | null>(null);
    const activeEndListenerRef = useRef<(() => void) | null>(null);

    const cleanupActiveListeners = () => {
        if (activeChunkListenerRef.current) {
            window.ipcRenderer.off('ai:chat-chunk', activeChunkListenerRef.current);
            activeChunkListenerRef.current = null;
        }
        if (activeEndListenerRef.current) {
            window.ipcRenderer.off('ai:chat-end', activeEndListenerRef.current);
            activeEndListenerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            cleanupActiveListeners();
        };
    }, []);

    // Comment editing states
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    // Detailed Planning states
    const [isDetailedPlanningLoading, setIsDetailedPlanningLoading] = useState(false);
    const [showPlanningInput, setShowPlanningInput] = useState(false);
    const [planningDirectives, setPlanningDirectives] = useState('');
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const handleTextareaSelect = () => {};
    const handleTextareaMouseUp = () => {};

    // Agent & Workflow interactive selection states
    const [workflows, setWorkflows] = useState<{ id: number; name: string; description?: string }[]>([]);
    const [activeAgentPopoverIndex, setActiveAgentPopoverIndex] = useState<number | null>(null);
    const [agentSearchQuery, setAgentSearchQuery] = useState('');

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

    // Parse comments and clean design document content
    const rawDoc = unwrapPlanningText(plan?.designDoc || '');
    const parsedDocComments: { id: string; body: string; context: string; rawBlock: string }[] = [];
    const cleanDocLines: string[] = [];
    const docLines = rawDoc.split('\n');
    
    for (let i = 0; i < docLines.length; i++) {
        const line = docLines[i];
        const match = line.match(COMMENT_LINE_REGEX);
        if (match) {
            parsedDocComments.push({
                id: `comment-doc-${i}`,
                body: match[1],
                context: match[2],
                rawBlock: line
            });
        } else {
            cleanDocLines.push(line);
        }
    }
    const cleanDocContent = cleanDocLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    // Parse comments and clean code planning content
    const rawPlanning = unwrapPlanningText(plan?.codePlanning || '');
    const parsedPlanningComments: { id: string; body: string; context: string; rawBlock: string }[] = [];
    const cleanPlanningLines: string[] = [];
    const planningLines = rawPlanning.split('\n');
    
    for (let i = 0; i < planningLines.length; i++) {
        const line = planningLines[i];
        const match = line.match(COMMENT_LINE_REGEX);
        if (match) {
            parsedPlanningComments.push({
                id: `comment-planning-${i}`,
                body: match[1],
                context: match[2],
                rawBlock: line
            });
        } else {
            cleanPlanningLines.push(line);
        }
    }
    const cleanPlanning = cleanPlanningLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    const handleCopyDoc = async () => {
        try {
            await navigator.clipboard.writeText(cleanDoc || '');
            setCopiedDoc(true);
            setTimeout(() => setCopiedDoc(false), 2000);
        } catch (err) {
            console.error('Failed to copy design doc:', err);
        }
    };

    const handleCopyPlanning = async () => {
        try {
            await navigator.clipboard.writeText(cleanPlanning || '');
            setCopiedPlanning(true);
            setTimeout(() => setCopiedPlanning(false), 2000);
        } catch (err) {
            console.error('Failed to copy code planning:', err);
        }
    };

    useEffect(() => {
        if (!showAddDocComment) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.add-doc-comment-container')) {
                setShowAddDocComment(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [showAddDocComment]);

    useEffect(() => {
        if (!showAddPlanningComment) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.add-planning-comment-container')) {
                setShowAddPlanningComment(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [showAddPlanningComment]);

    const getTargetIdForField = (text: string) => {
        const matchedComment = parsedDocComments.find(comment => {
            const cleanContext = comment.context.trim().toLowerCase();
            return cleanContext && text.toLowerCase().includes(cleanContext);
        });
        return matchedComment ? `comment-target-${matchedComment.id}` : undefined;
    };

    // Derived values based on active tab
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
              )
          )
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
    const cleanDoc = activeTab === 'planning' ? cleanPlanning : cleanDocContent;

    const handleDeleteComment = (commentToDelete: { rawBlock: string }) => {
        if (!plan) return;
        if (activeTab === 'planning' && planningSubTab === 'blueprints') {
            const currentPlanning = plan.codePlanning || '';
            const newPlanning = currentPlanning.replace(commentToDelete.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
            savePlan({ ...plan, codePlanning: newPlanning });
        } else {
            const currentDoc = plan.designDoc || '';
            const newDoc = currentDoc.replace(commentToDelete.rawBlock, '').replace(/\n{3,}/g, '\n\n').trim();
            savePlan({ ...plan, designDoc: newDoc });
        }
    };

    const handleEditComment = (commentToEdit: { rawBlock: string; context: string }, newBody: string) => {
        if (!plan || !newBody.trim()) return;
        const targetClean = commentToEdit.context.replace(/\n/g, ' ');
        const newCommentString = `> \u{1F4AC} **Refactor Comment:** ${newBody.trim()} \u2014 *on: "${targetClean}"*`;
        if (activeTab === 'planning' && planningSubTab === 'blueprints') {
            const currentPlanning = plan.codePlanning || '';
            const newPlanning = currentPlanning.replace(commentToEdit.rawBlock, newCommentString);
            savePlan({ ...plan, codePlanning: newPlanning });
        } else {
            const currentDoc = plan.designDoc || '';
            const newDoc = currentDoc.replace(commentToEdit.rawBlock, newCommentString);
            savePlan({ ...plan, designDoc: newDoc });
        }
    };

    const handleDetailedPlanning = async (directives?: string) => {
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
3. Conduct a highly thorough, detailed evaluation of the implementation trade-offs for all major design and architectural choices made in this plan. This must analyze choices like: class vs. method/function structure, dependency overhead, memory footprint, scalability, speed/performance, API design, security patterns (e.g. JWT vs sessions), and list alternative design options considered ("what if we made other choices?") with their pros and cons.
4. Conduct a thorough risk and consequence analysis for the choices made, detailing specific failure modes (what could go wrong under edge cases or load), their system/user consequences, harms, and how the implementation mitigates or guards against them.

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
      "task": "Major design choice/decision analyzed (e.g., 'Using helper class vs utility functions', 'SQLite local caching vs JSON file', 'JWT authentication')",
      "considerations": "Detailed pros/cons, memory/speed trade-offs, scalability, and alternative choices considered ('what if we made other choices?')",
      "decision": "Chosen design option and comprehensive justification for why it was selected"
    }
  ],
  "consequences": [
    {
      "failureMode": "Potential failure mode or risk of the chosen approach (e.g., DB lock during concurrent writes, memory leak on long-lived connections, key exposure)",
      "consequence": "Direct consequence/impact of this failure on the system or application",
      "harm": "How this failure harms the user, system integrity, or security",
      "mitigation": "Specific mitigation strategy or guard implemented in this plan to prevent or handle the failure"
    }
  ]
}
Ensure the JSON is strictly valid, and strings inside are properly escaped.`;

        let userPrompt = `Roadmap Steps:
${plan.steps.map(s => `- Step ${s.order} [${s.action} ${s.target}]: ${s.rationale}`).join('\n')}

Expected Outcome:
${plan.expectedOutcome}

Files to Modify:
${plan.filesToModify.join('\n')}

Files to Create:
${plan.steps.filter(s => s.action === 'create').map(s => s.target).join('\n')}

Existing Design Document:
${cleanDoc}`;

        if (directives && directives.trim()) {
            userPrompt += `\n\nUser Custom Planning Directives/Constraints to respect:\n${directives.trim()}`;
        }

        let resultText = '';

        const handleChunk = (_: any, chunk: string) => {
            if (!chunk.startsWith('Error:')) {
                resultText += chunk;
            }
        };

        const handleEnd = async () => {
            cleanupActiveListeners();
            setIsDetailedPlanningLoading(false);

            const rawText = resultText.trim();
            if (rawText) {
                let parsedDesignDoc = '';
                let parsedClassDeps: any[] = [];
                let parsedTradeoffs: any[] = [];
                let parsedConsequences: any[] = [];
                try {
                    let cleanText = rawText;
                    if (cleanText.startsWith('```')) {
                        // Extract content inside first code fence block
                        const match = cleanText.match(/```/i); // simplified match
                        const lastMatch = cleanText.lastIndexOf('```');
                        if (match && lastMatch !== -1) {
                            cleanText = cleanText.substring(cleanText.indexOf('\n') + 1, lastMatch).trim();
                        }
                    }
                    const parsed = JSON.parse(cleanText);
                    if (parsed && typeof parsed === 'object') {
                        parsedDesignDoc = unwrapPlanningText(parsed.designDoc);
                        if (Array.isArray(parsed.classDependencies)) {
                            parsedClassDeps = parsed.classDependencies;
                        }
                        if (Array.isArray(parsed.tradeoffs)) {
                            parsedTradeoffs = parsed.tradeoffs;
                        }
                        if (Array.isArray(parsed.consequences)) {
                            parsedConsequences = parsed.consequences;
                        }
                    }
                } catch (e) {
                    // Try robust JSON extraction and merging
                    const parsedObjects = cleanAndExtractJSONObjects(rawText);
                    if (parsedObjects.length > 0) {
                        const merged = mergeExecutionPlans(parsedObjects);
                        parsedDesignDoc = unwrapPlanningText(merged.designDoc);
                        parsedClassDeps = merged.classDependencies || [];
                        parsedTradeoffs = merged.tradeoffs || [];
                        parsedConsequences = merged.consequences || [];
                    } else {
                        console.warn('Failed to parse detailed planning JSON output, falling back to raw text:', e);
                        parsedDesignDoc = unwrapPlanningText(rawText);
                    }
                }

                if (parsedDesignDoc) {
                    // Preserve comments from Code Planning
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

                    savePlan({ 
                        ...plan, 
                        codePlanning: finalDoc,
                        classDependencies: parsedClassDeps.length > 0 ? parsedClassDeps : undefined,
                        planningTradeoffs: mergedPlanningTradeoffs.length > 0 ? mergedPlanningTradeoffs : plan.planningTradeoffs,
                        planningConsequences: mergedPlanningConsequences.length > 0 ? mergedPlanningConsequences : plan.planningConsequences
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
                        errorMessage: 'The model did not return valid plan JSON.'
                    }
                }));
            }
        };

        cleanupActiveListeners();
        activeChunkListenerRef.current = handleChunk;
        activeEndListenerRef.current = handleEnd;
        window.ipcRenderer.on('ai:chat-chunk', handleChunk);
        window.ipcRenderer.on('ai:chat-end', handleEnd);

        window.ipcRenderer.send('ai:chat-start', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });
    };

    // Comments dynamic offsets and hover synchronization
    const [commentOffsets, setCommentOffsets] = useState<Record<string, number>>({});
    const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const updateCommentOffsets = () => {
        if (!containerRef.current || parsedComments.length === 0) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newOffsets: Record<string, number> = {};

        parsedComments.forEach(comment => {
            const el = document.getElementById(`comment-target-${comment.id}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Get offset top relative to the container scroll box
                const topOffset = rect.top - containerRect.top + containerRef.current!.scrollTop;
                newOffsets[comment.id] = topOffset;
            }
        });

        // Resolve overlaps
        const sortedIds = Object.keys(newOffsets).sort((a, b) => newOffsets[a] - newOffsets[b]);
        const minSpacing = 70; // Highly compact for the new floating overlay style
        for (let i = 1; i < sortedIds.length; i++) {
            const prevId = sortedIds[i - 1];
            const currId = sortedIds[i];
            if (newOffsets[currId] < newOffsets[prevId] + minSpacing) {
                newOffsets[currId] = newOffsets[prevId] + minSpacing;
            }
        }

        setCommentOffsets(newOffsets);
    };

    useEffect(() => {
        if (activeTab !== 'doc' && activeTab !== 'planning') return;

        let frameId = 0;
        const scheduleUpdate = () => {
            cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateCommentOffsets);
        };

        scheduleUpdate();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleUpdate)
            : null;

        if (containerRef.current) {
            resizeObserver?.observe(containerRef.current);
        }

        const markdownSelector = activeTab === 'planning' 
            ? (planningSubTab === 'blueprints' ? '.code-planning-markdown' : '.tradeoffs-container') 
            : (activeTab === 'doc' ? '.design-doc-markdown' : '.tradeoffs-container');
        const markdownEl = document.querySelector(markdownSelector);
        if (markdownEl && resizeObserver) {
            resizeObserver.observe(markdownEl);
        }

        window.addEventListener('resize', scheduleUpdate);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', scheduleUpdate);
            resizeObserver?.disconnect();
        };
    }, [activeTab, planningSubTab, cleanDocContent, cleanPlanning, parsedComments.length]);

    // Inline highlighting tooltip states & handlers
    const [selectedTextInfo, setSelectedTextInfo] = useState<{
        text: string;
        start: number;
        end: number;
        isTextarea: boolean;
        x: number;
        y: number;
    } | null>(null);
    const [showSelectionPopup, setShowSelectionPopup] = useState<'menu' | 'comment' | 'edit' | null>(null);
    const [commentText, setCommentText] = useState('');
    const [editInstruction, setEditInstruction] = useState('');
    const [isInlineAiLoading, setIsInlineAiLoading] = useState(false);
    const [inlineAiError, setInlineAiError] = useState<string | null>(null);
    const selectionPopupRef = useRef<HTMLDivElement>(null);

    // Click-outside to dismiss selection popup
    useEffect(() => {
        if (!selectedTextInfo) return;
        const handleMouseDown = (e: MouseEvent) => {
            if (selectionPopupRef.current && !selectionPopupRef.current.contains(e.target as Node)) {
                setSelectedTextInfo(null);
                setShowSelectionPopup(null);
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [selectedTextInfo]);

    // Global selection mouseup event listener to ensure immediate, robust first-time popups
    useEffect(() => {
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (activeTab !== 'doc' && activeTab !== 'planning') return;

            const selector = activeTab === 'planning' 
                ? (planningSubTab === 'blueprints' ? '.code-planning-markdown' : '.tradeoffs-container') 
                : (activeTab === 'doc' ? '.design-doc-markdown' : '.tradeoffs-container');
            const markdownEl = document.querySelector(selector);
            if (!markdownEl) return;

            setTimeout(() => {
                const sel = window.getSelection();
                if (sel && sel.toString().trim()) {
                    const text = sel.toString();
                    
                    try {
                        const range = sel.getRangeAt(0);
                        if (markdownEl.contains(range.commonAncestorContainer) || markdownEl.contains(range.startContainer)) {
                            const { x: popupX, y: popupY } = calcPopupPos(e.clientX, e.clientY);
                            setSelectedTextInfo({ text, start: 0, end: 0, isTextarea: false, x: popupX, y: popupY });
                            setShowSelectionPopup('menu');
                        }
                    } catch (err) {
                        console.error('Failed to get selection range:', err);
                    }
                }
            }, 50);
        };

        document.addEventListener('mouseup', handleGlobalMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [activeTab, planningSubTab]);

    const calcPopupPos = (mouseX: number, mouseY: number): { x: number; y: number } => {
        const popupWidth = 324;
        const popupHeight = 120; // approx menu height
        const padding = 10;
        const x = Math.max(padding, Math.min(window.innerWidth - popupWidth - padding, mouseX - 160));
        // Prefer below cursor; flip above if too close to bottom
        const spaceBelow = window.innerHeight - mouseY;
        const y = spaceBelow > popupHeight + 24
            ? mouseY + 14
            : Math.max(padding, mouseY - popupHeight - 14);
        return { x, y };
    };



    // Removed handlePreviewMouseUp in favor of the global handleGlobalMouseUp listener

    const handleLeaveCommentSubmit = () => {
        if (!plan || !selectedTextInfo || !commentText.trim()) return;
        const currentPlan = plan;
        const targetClean = selectedTextInfo.text.replace(/\n/g, ' ');
        const commentString = `\n> \u{1F4AC} **Refactor Comment:** ${commentText} \u2014 *on: "${targetClean}"*\n`;
        
        if (activeTab === 'planning') {
            const originalPlanning = currentPlan.codePlanning || '';
            const newText = originalPlanning.trim() + `\n\n` + commentString;
            savePlan({ ...currentPlan, codePlanning: newText });
        } else {
            const originalDoc = currentPlan.designDoc || '';
            const newText = originalDoc.trim() + `\n\n` + commentString;
            savePlan({ ...currentPlan, designDoc: newText });
        }

        setSelectedTextInfo(null);
        setShowSelectionPopup(null);
        setCommentText('');
        setEditInstruction('');
    };

    const handleQuickEditSubmit = async () => {
        if (!plan || !selectedTextInfo || !editInstruction.trim()) return;
        const currentPlan = plan;
        setIsInlineAiLoading(true);
        const currentInstruction = editInstruction.trim();

        window.dispatchEvent(new CustomEvent('plan:modify-started', {
            detail: { instructions: `Quick Edit text: "${selectedTextInfo.text.substring(0, 60)}${selectedTextInfo.text.length > 60 ? '...' : ''}" -> "${currentInstruction}"` }
        }));

        const prompt = `You are a technical editor. Rewrite the following selected block of a design document or plan based on the instruction provided. Return ONLY the rewritten text without any markdown wrappers (unless they are part of the content itself), warnings, or explanations. Keep the exact format of the content.

Selected text block to modify:
"""
${selectedTextInfo.text}
"""

Instruction:
${editInstruction}

Rewritten block:`;

        let resultText = '';

        const handleChunk = (_: any, chunk: string) => {
            if (!chunk.startsWith('Error:')) {
                resultText += chunk;
            }
        };

        const handleEnd = async () => {
            cleanupActiveListeners();
            setIsInlineAiLoading(false);

            const replacement = resultText.trim();
            let success = false;
            
            {
                const originalText = activeTab === 'planning' ? (currentPlan.codePlanning || '') : (currentPlan.designDoc || '');
                const match = findMarkdownSubstring(originalText, selectedTextInfo.text);
                if (match) {
                    const newText = originalText.substring(0, match.start) + replacement + originalText.substring(match.end);
                    if (activeTab === 'planning') {
                        savePlan({ ...currentPlan, codePlanning: newText });
                    } else {
                        savePlan({ ...currentPlan, designDoc: newText });
                    }
                    success = true;
                } else {
                    const newText = originalText.replace(selectedTextInfo.text, replacement);
                    if (activeTab === 'planning') {
                        savePlan({ ...currentPlan, codePlanning: newText });
                    } else {
                        savePlan({ ...currentPlan, designDoc: newText });
                    }
                    success = originalText !== newText;
                }
            }

            window.dispatchEvent(new CustomEvent('plan:modify-ended', {
                detail: { 
                    success, 
                    description: success 
                        ? `Rewrote design doc section based on instruction: "${currentInstruction}"` 
                        : `Could not locate selection in document to rewrite.` 
                }
            }));

            setSelectedTextInfo(null);
            setShowSelectionPopup(null);
            setEditInstruction('');
        };

        cleanupActiveListeners();
        activeChunkListenerRef.current = handleChunk;
        activeEndListenerRef.current = handleEnd;
        window.ipcRenderer.on('ai:chat-chunk', handleChunk);
        window.ipcRenderer.on('ai:chat-end', handleEnd);

        window.ipcRenderer.send('ai:chat-start', {
            messages: [
                { role: 'user', content: prompt }
            ]
        });
    };

    useEffect(() => {
        loadPlan();
        loadAgents();
    }, [taskId]);

    useEffect(() => {
        const handlePlanReloaded = () => {
            loadPlan();
        };
        window.addEventListener('plan-reloaded', handlePlanReloaded);
        return () => {
            window.removeEventListener('plan-reloaded', handlePlanReloaded);
        };
    }, [taskId]);

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

    const handleModifyWithAI = async () => {
        if (!aiInstructions.trim()) return;
        setIsAiLoading(true);
        const currentInstructions = aiInstructions.trim();

        window.dispatchEvent(new CustomEvent('plan:modify-started', {
            detail: { instructions: currentInstructions }
        }));
        
        const agentsList = agents.map(a => a.name).join(', ');
        const workflowsList = workflows.map(w => w.name).join(', ');
        const assignInstructions = (agentsList || workflowsList)
            ? `- For each step's "agent" field, you may only choose from the following existing agents: [${agentsList || 'None'}] or workflows: [${workflowsList || 'None'}]. If no existing agents or workflows match the step or if none are available, leave the "agent" field empty/blank (or do not include it). Do NOT invent new agent/workflow names.`
            : `- Do NOT assign any agent to step "agent" fields (leave "agent" empty or omit it) as no agents or workflows are currently defined in the system.`;

        const systemPrompt = `You are an expert system architect. You are given an execution plan in JSON format and developer instructions.
- If the instructions ask to modify or update the existing plan, apply the modifications and output the updated plan.
- To prevent data loss and save tokens, do NOT rewrite unchanged sections. If the developer's instructions only target the roadmap steps, preserve the existing 'designDoc', 'expectedOutcome', 'filesRead', 'filesToModify', 'verificationCriteria', 'tradeoffs', and 'consequences' exactly as they are. If the instructions target only a specific component or section, focus only on updating that relevant part and output the rest of the fields identical to the input.
- If the instructions ask to create a new plan, regenerate the plan, or start from scratch, discard the existing plan and generate a completely new execution plan from scratch based on the developer instructions.
${assignInstructions}
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

        let fullResponse = '';

        const handleChunk = (_: any, chunk: string) => {
            if (!chunk.startsWith('Error:')) {
                fullResponse += chunk;
            }
        };

        const handleEnd = async () => {
            cleanupActiveListeners();
            setIsAiLoading(false);
            setAiInstructions('');

            try {
                let parsed: ExecutionPlan;
                try {
                    let cleanJson = fullResponse.trim();
                    const firstBrace = cleanJson.indexOf('{');
                    const lastBrace = cleanJson.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                    }
                    parsed = JSON.parse(cleanJson) as ExecutionPlan;
                } catch (jsonErr) {
                    const parsedObjects = cleanAndExtractJSONObjects(fullResponse);
                    if (parsedObjects.length > 0) {
                        parsed = mergeExecutionPlans(parsedObjects) as ExecutionPlan;
                    } else {
                        throw jsonErr;
                    }
                }
                
                const cleanedSteps = (parsed.steps || []).map((step, idx) => ({
                    ...step,
                    order: step.order || idx + 1,
                    completed: !!step.completed
                }));
                
                const updatedPlan = {
                    ...parsed,
                    steps: cleanedSteps,
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
        };

        cleanupActiveListeners();
        activeChunkListenerRef.current = handleChunk;
        activeEndListenerRef.current = handleEnd;
        window.ipcRenderer.on('ai:chat-chunk', handleChunk);
        window.ipcRenderer.on('ai:chat-end', handleEnd);

        window.ipcRenderer.send('ai:chat-start', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        });
    };

    const loadPlan = async () => {
        try {
            const res = await window.ipcRenderer.invoke('plan:get', taskId);
            if (res && res.plan_json) {
                let parsed: ExecutionPlan;
                try {
                    parsed = JSON.parse(res.plan_json) as ExecutionPlan;
                } catch (parseErr) {
                    const parsedObjects = cleanAndExtractJSONObjects(res.plan_json);
                    if (parsedObjects.length > 0) {
                        parsed = mergeExecutionPlans(parsedObjects) as ExecutionPlan;
                    } else {
                        throw parseErr;
                    }
                }
                const cleanedSteps = (parsed.steps || []).map((step, idx) => ({
                    ...step,
                    order: step.order || idx + 1,
                    completed: !!step.completed
                }));
                setPlan({
                    ...parsed,
                    steps: cleanedSteps
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
                    designDoc: `# Implementation Design Doc\n\nDescribe your architectural blueprint, module configurations, and code modifications here.`
                });
            }
        } catch (e) {
            console.error('Failed to load task plan:', e);
        }
    };

    const savePlan = async (updatedPlan: ExecutionPlan) => {
        try {
            await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(updatedPlan));
            setPlan(updatedPlan);
        } catch (e) {
            console.error('Failed to save plan:', e);
        }
    };

    if (!plan) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: '8px' }} />
                Loading implementation plan...
            </div>
        );
    }

    const completedCount = plan.steps.filter(s => s.completed).length;
    const progressPercent = plan.steps.length > 0 ? Math.round((completedCount / plan.steps.length) * 100) : 0;

    const toggleStepCompleted = (index: number) => {
        const updatedSteps = [...plan.steps];
        updatedSteps[index].completed = !updatedSteps[index].completed;
        savePlan({ ...plan, steps: updatedSteps });
    };

    const handleStartEdit = (index: number, step: PlanStep) => {
        setEditingStepIndex(index);
        setEditStepData({ ...step });
    };

    const handleSaveEdit = (index: number) => {
        if (!editStepData) return;
        const updatedSteps = [...plan.steps];
        updatedSteps[index] = editStepData;
        savePlan({ ...plan, steps: updatedSteps });
        setEditingStepIndex(null);
        setEditStepData(null);
    };

    const handleSelectAgentOrWorkflow = (index: number, selection: string) => {
        const updatedSteps = [...plan.steps];
        updatedSteps[index] = {
            ...updatedSteps[index],
            agent: selection ? selection : undefined
        };
        savePlan({ ...plan, steps: updatedSteps });
        setActiveAgentPopoverIndex(null);
        setAgentSearchQuery('');
    };

    const handleDeleteStep = (index: number) => {
        const updatedSteps = plan.steps.filter((_, idx) => idx !== index).map((s, idx) => ({
            ...s,
            order: idx + 1
        }));
        savePlan({ ...plan, steps: updatedSteps });
        if (editingStepIndex === index) {
            setEditingStepIndex(null);
            setEditStepData(null);
        }
    };

    const handleAddStep = () => {
        const order = plan.steps.length + 1;
        const defaultStep: PlanStep = {
            order,
            action: 'read',
            target: 'src/',
            rationale: 'Inspect source code components',
            completed: false
        };
        savePlan({ ...plan, steps: [...plan.steps, defaultStep] });
    };

    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === plan.steps.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const updatedSteps = [...plan.steps];
        const temp = updatedSteps[index];
        updatedSteps[index] = updatedSteps[targetIndex];
        updatedSteps[targetIndex] = temp;

        const normalized = updatedSteps.map((s, idx) => ({
            ...s,
            order: idx + 1
        }));

        savePlan({ ...plan, steps: normalized });
    };

    const getActionBadgeStyle = (action: string) => {
        switch (action) {
            case 'read':
                return { background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' };
            case 'analyze':
                return { background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' };
            case 'modify':
                return { background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.2)' };
            case 'create':
                return { background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' };
            case 'delete':
                return { background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' };
            case 'run_command':
                return { background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.2)' };
            default:
                return { background: 'rgba(255, 255, 255, 0.05)', color: '#e5e7eb', border: '1px solid rgba(255, 255, 255, 0.1)' };
        }
    };

    const handleSaveExpectedOutcome = () => {
        savePlan({ ...plan, expectedOutcome: editingExpectedOutcomeText });
        setIsEditingExpectedOutcome(false);
    };

    const handleSaveReadItem = (index: number) => {
        const updated = [...plan.filesRead];
        updated[index] = editingReadText.trim();
        savePlan({ ...plan, filesRead: updated.filter(Boolean) });
        setEditingReadIndex(null);
    };

    const handleDeleteReadItem = (index: number) => {
        savePlan({ ...plan, filesRead: plan.filesRead.filter((_, i) => i !== index) });
    };

    const handleAddReadItem = () => {
        if (!newReadText.trim()) return;
        savePlan({ ...plan, filesRead: [...plan.filesRead, newReadText.trim()] });
        setNewReadText('');
        setShowAddRead(false);
    };

    const handleSaveModifyItem = (index: number) => {
        const updated = [...plan.filesToModify];
        updated[index] = editingModifyText.trim();
        savePlan({ ...plan, filesToModify: updated.filter(Boolean) });
        setEditingModifyIndex(null);
    };

    const handleDeleteModifyItem = (index: number) => {
        savePlan({ ...plan, filesToModify: plan.filesToModify.filter((_, i) => i !== index) });
    };

    const handleAddModifyItem = () => {
        if (!newModifyText.trim()) return;
        savePlan({ ...plan, filesToModify: [...plan.filesToModify, newModifyText.trim()] });
        setNewModifyText('');
        setShowAddModify(false);
    };

    const handleSaveCritItem = (index: number) => {
        const updated = [...plan.verificationCriteria];
        updated[index] = editingCritText.trim();
        savePlan({ ...plan, verificationCriteria: updated.filter(Boolean) });
        setEditingCritIndex(null);
    };

    const handleDeleteCritItem = (index: number) => {
        savePlan({ ...plan, verificationCriteria: plan.verificationCriteria.filter((_, i) => i !== index) });
    };

    const handleAddCritItem = () => {
        if (!newCritText.trim()) return;
        savePlan({ ...plan, verificationCriteria: [...plan.verificationCriteria, newCritText.trim()] });
        setNewCritText('');
        setShowAddCrit(false);
    };





    const handleApprovePlan = async () => {
        const approvedPlan = { ...plan, approved: true };
        await savePlan(approvedPlan);
        
        // Assemble steps and details into a clear message to trigger the backend execution process
        const stepsMessage = approvedPlan.steps.map(s => `- Step ${s.order} [${s.action} on ${s.target}]: ${s.rationale}`).join('\n');
        const agentPrompt = `Approved execution plan for Task ID ${taskId}.\n\nExpected Outcome:\n${approvedPlan.expectedOutcome}\n\nVerification Criteria:\n${approvedPlan.verificationCriteria.map(c => `- ${c}`).join('\n')}\n\nPlease proceed to run and execute the roadmap steps:\n${stepsMessage}`;
        
        try {
            await window.ipcRenderer.invoke('openclaw:run-agent', agentPrompt, 'high');
        } catch (err) {
            console.error('Failed to trigger agent plan execution process:', err);
        }
    };

    const handleRevokeApproval = () => {
        savePlan({ ...plan, approved: false });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, system-ui, sans-serif',
            overflow: 'hidden'
        }}>
            {/* Top Approval State Banner */}
            <div style={{
                padding: '12px 24px',
                background: plan.approved
                    ? 'linear-gradient(90deg, rgba(52, 211, 153, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
                    : 'linear-gradient(90deg, rgba(129, 140, 248, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)',
                borderBottom: plan.approved
                    ? '1px solid rgba(52, 211, 153, 0.2)'
                    : '1px solid rgba(129, 140, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                    <span className={`codicon ${plan.approved ? 'codicon-pass-filled' : 'codicon-info'}`} style={{ color: plan.approved ? '#34d399' : '#818cf8', fontSize: '15px' }} />
                    <span>
                        {plan.approved 
                            ? 'Plan Approved & Active. Executing roadmap steps...' 
                            : 'Review Draft Plan: You can modify steps inline or ask AI to refine the details, then approve when ready.'}
                    </span>
                </div>
                {plan.approved ? (
                    <button
                        onClick={handleRevokeApproval}
                        style={{
                            padding: '4px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '4px',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span className="codicon codicon-history" /> Revoke Approval
                    </button>
                ) : (
                    <button
                        onClick={handleApprovePlan}
                        style={{
                            padding: '6px 14px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        <span className="codicon codicon-rocket" /> Approve Plan
                    </button>
                )}
            </div>

            {/* Header Area */}
            <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(13, 17, 23, 0.7)',
                backdropFilter: 'blur(12px)',
                flexShrink: 0
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'white', letterSpacing: '-0.01em' }}>Execution Roadmap</h2>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>Interactive developer blueprint for Task ID: {taskId}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{progressPercent}% Complete</span>
                        <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #34d399 0%, #059669 100%)', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                background: 'rgba(13, 17, 23, 0.4)',
                backdropFilter: 'blur(12px)',
                padding: '0 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                gap: '8px',
                flexShrink: 0,
                alignItems: 'center',
                position: 'relative',
                zIndex: 50
            }}>
                {/* Sleek Pill Orange Button for Code Planning with popup input directives */}
                <div className="planning-popover-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                    <button
                        className="planning-trigger-btn"
                        onClick={() => setShowPlanningInput(!showPlanningInput)}
                        disabled={isDetailedPlanningLoading}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '16px',
                            background: isDetailedPlanningLoading 
                                ? 'rgba(234, 88, 12, 0.3)' 
                                : 'linear-gradient(135deg, #ff8c3a 0%, #ea580c 100%)', // Vibrant premium orange
                            border: 'none',
                            color: 'white',
                            cursor: isDetailedPlanningLoading ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 0 8px rgba(234, 88, 12, 0.3)',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                            fontSize: '11px',
                            fontWeight: 600
                        }}
                        title="Generate Code Planning: Writes code drafts and design explanations"
                    >
                        {isDetailedPlanningLoading ? (
                            <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '12px' }} />
                        ) : (
                            <span className="codicon codicon-code" style={{ fontSize: '12px' }} />
                        )}
                        <span>Generate Code Planning</span>
                    </button>
 
                    {showPlanningInput && (
                        <div style={{
                            position: 'absolute',
                            top: '36px',
                            left: '0',
                            width: '300px',
                            background: 'rgba(15, 23, 42, 0.98)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '12px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 12px rgba(234, 88, 12, 0.2)',
                            zIndex: 1000,
                            backdropFilter: 'blur(16px)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            animation: 'fadeIn 0.15s ease'
                        }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>
                                Code Planning Directives
                            </div>
                            <textarea
                                value={planningDirectives}
                                onChange={e => setPlanningDirectives(e.target.value)}
                                placeholder="Specify custom constraints, patterns, libraries, or files to prioritize (optional)..."
                                style={{
                                    width: '100%',
                                    height: '80px',
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
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        handleDetailedPlanning(planningDirectives);
                                        setShowPlanningInput(false);
                                    }
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                    onClick={() => setShowPlanningInput(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        padding: '4px 8px'
                                    }}
                                >Cancel</button>
                                <button
                                    onClick={() => {
                                        handleDetailedPlanning(planningDirectives);
                                        setShowPlanningInput(false);
                                    }}
                                    style={{
                                        background: 'linear-gradient(135deg, #ff8c3a 0%, #ea580c 100%)',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        padding: '4px 10px'
                                    }}
                                >Generate</button>
                            </div>
                        </div>
                    )}
                </div>

                {((cleanPlanning && cleanPlanning.trim()) || isDetailedPlanningLoading) && (
                    <button
                        onClick={() => setActiveTab('planning')}
                        style={{
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'planning' ? '2px solid #818cf8' : '2px solid transparent',
                            color: activeTab === 'planning' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                            fontSize: '13px',
                            fontWeight: activeTab === 'planning' ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >Code Planning</button>
                )}
                <button
                    onClick={() => setActiveTab('doc')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'doc' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'doc' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'doc' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Design Doc</button>
                <button
                    onClick={() => setActiveTab('tradeoffs')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'tradeoffs' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'tradeoffs' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'tradeoffs' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Implementation Trade-offs</button>
                <button
                    onClick={() => setActiveTab('consequences')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'consequences' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'consequences' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'consequences' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Failure Modes & Consequences</button>
                <button
                    onClick={() => setActiveTab('steps')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'steps' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'steps' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'steps' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Roadmap Steps</button>
                <button
                    onClick={() => setActiveTab('overview')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'overview' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'overview' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'overview' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Details & Context</button>

                <button
                    onClick={() => setActiveTab('flow')}
                    style={{
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'flow' ? '2px solid #818cf8' : '2px solid transparent',
                        color: activeTab === 'flow' ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'flow' ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >Visual Flow</button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {activeTab === 'steps' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
                        {plan.steps.map((step, index) => {
                            const isEditing = editingStepIndex === index;
                            return (
                                <div
                                    key={index}
                                    style={{
                                        background: step.completed 
                                            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.05) 0%, rgba(52, 211, 153, 0.01) 100%)' 
                                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                                        border: isEditing 
                                            ? '1px solid #818cf8' 
                                            : step.completed 
                                                ? '1px solid rgba(52, 211, 153, 0.25)' 
                                                : '1px solid rgba(255, 255, 255, 0.06)',
                                        borderRadius: '10px',
                                        padding: '18px',
                                        display: 'flex',
                                        gap: '16px',
                                        alignItems: 'flex-start',
                                        position: 'relative',
                                        boxShadow: isEditing 
                                            ? '0 0 16px rgba(129, 140, 248, 0.15)' 
                                            : '0 4px 20px rgba(0, 0, 0, 0.15)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        backdropFilter: 'blur(8px)'
                                    }}
                                >
                                    {/* Glowing Custom Checkbox */}
                                    <div
                                        onClick={() => !isEditing && toggleStepCompleted(index)}
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '6px',
                                            border: step.completed ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.25)',
                                            background: step.completed 
                                                ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' 
                                                : 'rgba(255, 255, 255, 0.02)',
                                            boxShadow: step.completed 
                                                ? '0 0 10px rgba(52, 211, 153, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)' 
                                                : 'inset 0 1px 2px rgba(255,255,255,0.05)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        {step.completed && <span className="codicon codicon-check" style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }} />}
                                    </div>

                                    {/* Step Details */}
                                    <div style={{ flex: 1 }}>
                                        {isEditing && editStepData ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <select
                                                        value={editStepData.action}
                                                        onChange={e => setEditStepData({ ...editStepData, action: e.target.value as any })}
                                                        style={{
                                                            background: 'rgba(0, 0, 0, 0.4)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'white',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            fontSize: '12px'
                                                        }}
                                                    >
                                                        <option value="read">read</option>
                                                        <option value="analyze">analyze</option>
                                                        <option value="modify">modify</option>
                                                        <option value="create">create</option>
                                                        <option value="delete">delete</option>
                                                        <option value="run_command">run_command</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={editStepData.target}
                                                        onChange={e => setEditStepData({ ...editStepData, target: e.target.value })}
                                                        style={{
                                                            flex: 1,
                                                            background: 'rgba(0, 0, 0, 0.4)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'white',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            fontSize: '12px'
                                                        }}
                                                    />
                                                </div>
                                                <textarea
                                                    value={editStepData.rationale}
                                                    onChange={e => setEditStepData({ ...editStepData, rationale: e.target.value })}
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '60px',
                                                        background: 'rgba(0, 0, 0, 0.4)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        color: 'white',
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        outline: 'none',
                                                        resize: 'vertical',
                                                        fontSize: '12px'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <select
                                                        value={editStepData.agent || ''}
                                                        onChange={e => setEditStepData({ ...editStepData, agent: e.target.value })}
                                                        style={{
                                                            flex: 1,
                                                            background: 'rgba(0, 0, 0, 0.4)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'white',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            fontSize: '11px'
                                                        }}
                                                    >
                                                        <option value="">No Assignment</option>
                                                        <optgroup label="Agents">
                                                            {agents.map(a => (
                                                                <option key={`edit-agent-${a.id}`} value={a.name}>{a.name}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="Workflows">
                                                            {workflows.map(w => (
                                                                <option key={`edit-flow-${w.id}`} value={`Workflow: ${w.name}`}>{w.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Notes (optional)"
                                                        value={editStepData.notes || ''}
                                                        onChange={e => setEditStepData({ ...editStepData, notes: e.target.value })}
                                                        style={{
                                                            flex: 1,
                                                            background: 'rgba(0, 0, 0, 0.4)',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            color: 'white',
                                                            padding: '6px 10px',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            fontSize: '11px'
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginTop: '4px' }}>
                                                    <button onClick={() => setEditingStepIndex(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                    <button onClick={() => handleSaveEdit(index)} style={{ padding: '6px 14px', background: '#818cf8', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Save Changes</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        fontSize: '10px',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        ...getActionBadgeStyle(step.action)
                                                    }}>
                                                        {step.action}
                                                    </span>
                                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'white' }}>{step.target}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.55 }}>{step.rationale}</p>
                                                
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '12px', fontSize: '11px' }}>
                                                    {/* Clickable Agent/Workflow Selection Badge */}
                                                    <div style={{ position: 'relative' }} className="agent-popover-container">
                                                        {step.agent && (() => {
                                                            const isWorkflow = step.agent.startsWith('Workflow:');
                                                            const displayLabel = isWorkflow ? step.agent.replace('Workflow:', '').trim() : step.agent;
                                                            return isWorkflow 
                                                                ? workflows.some(w => w.name === displayLabel) 
                                                                : agents.some(a => a.name === displayLabel);
                                                        })() ? (
                                                            (() => {
                                                                const isWorkflow = step.agent.startsWith('Workflow:');
                                                                const displayLabel = isWorkflow ? step.agent.replace('Workflow:', '').trim() : step.agent;
                                                                
                                                                return (
                                                                    <div
                                                                        onClick={() => {
                                                                            setActiveAgentPopoverIndex(activeAgentPopoverIndex === index ? null : index);
                                                                            setAgentSearchQuery('');
                                                                        }}
                                                                        className="agent-badge-trigger"
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            cursor: 'pointer',
                                                                            background: isWorkflow ? 'rgba(234, 88, 12, 0.12)' : 'rgba(129, 140, 248, 0.12)',
                                                                            border: isWorkflow ? '1px solid rgba(234, 88, 12, 0.35)' : '1px solid rgba(129, 140, 248, 0.35)',
                                                                            padding: '3px 10px',
                                                                            borderRadius: '12px',
                                                                            color: isWorkflow ? '#ff9d5c' : '#a5b4fc',
                                                                            fontWeight: 500,
                                                                            transition: 'all 0.2s ease',
                                                                            boxShadow: isWorkflow ? '0 0 6px rgba(234, 88, 12, 0.1)' : '0 0 6px rgba(129, 140, 248, 0.1)'
                                                                        }}
                                                                        onMouseOver={e => {
                                                                            e.currentTarget.style.background = isWorkflow ? 'rgba(234, 88, 12, 0.2)' : 'rgba(129, 140, 248, 0.2)';
                                                                            e.currentTarget.style.borderColor = isWorkflow ? 'rgba(234, 88, 12, 0.6)' : 'rgba(129, 140, 248, 0.6)';
                                                                        }}
                                                                        onMouseOut={e => {
                                                                            e.currentTarget.style.background = isWorkflow ? 'rgba(234, 88, 12, 0.12)' : 'rgba(129, 140, 248, 0.12)';
                                                                            e.currentTarget.style.borderColor = isWorkflow ? 'rgba(234, 88, 12, 0.35)' : 'rgba(129, 140, 248, 0.35)';
                                                                        }}
                                                                        title="Click to re-assign agent or workflow"
                                                                    >
                                                                        <span className={isWorkflow ? "codicon codicon-git-merge" : "codicon codicon-hubot"} />
                                                                        <span>{isWorkflow ? 'Workflow' : 'Agent'}: <strong>{displayLabel}</strong></span>
                                                                        <span className="codicon codicon-chevron-down" style={{ fontSize: '9px', opacity: 0.7 }} />
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <div
                                                                onClick={() => {
                                                                    setActiveAgentPopoverIndex(activeAgentPopoverIndex === index ? null : index);
                                                                    setAgentSearchQuery('');
                                                                }}
                                                                className="agent-badge-trigger"
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    cursor: 'pointer',
                                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                                                                    padding: '3px 10px',
                                                                    borderRadius: '12px',
                                                                    color: 'rgba(255, 255, 255, 0.45)',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onMouseOver={e => {
                                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                                                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                                                }}
                                                                onMouseOut={e => {
                                                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)';
                                                                }}
                                                            >
                                                                <span className="codicon codicon-add" style={{ fontSize: '10px' }} />
                                                                <span>Assign Agent/Workflow</span>
                                                            </div>
                                                        )}
 
                                                        {/* Dynamic Popover with Search Filter */}
                                                        {activeAgentPopoverIndex === index && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '28px',
                                                                left: '0',
                                                                width: '260px',
                                                                background: 'rgba(15, 23, 42, 0.96)',
                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                borderRadius: '8px',
                                                                padding: '10px',
                                                                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 12px rgba(129, 140, 248, 0.15)',
                                                                zIndex: 200,
                                                                backdropFilter: 'blur(16px)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '8px',
                                                                animation: 'fadeIn 0.15s ease'
                                                            }}>
                                                                {/* Search Input Box */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '4px 8px' }}>
                                                                    <span className="codicon codicon-search" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }} />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search agents or workflows..."
                                                                        value={agentSearchQuery}
                                                                        onChange={e => setAgentSearchQuery(e.target.value)}
                                                                        autoFocus
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            color: 'white',
                                                                            outline: 'none',
                                                                            fontSize: '11px',
                                                                            width: '100%'
                                                                        }}
                                                                    />
                                                                </div>
 
                                                                {/* Scrollable Selector List */}
                                                                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                    {/* Unassign Option */}
                                                                    <div
                                                                        onClick={() => handleSelectAgentOrWorkflow(index, '')}
                                                                        style={{
                                                                            padding: '6px 8px',
                                                                            fontSize: '11px',
                                                                            color: 'rgba(255,255,255,0.45)',
                                                                            cursor: 'pointer',
                                                                            borderRadius: '4px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            transition: 'background 0.15s'
                                                                        }}
                                                                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                    >
                                                                        <span className="codicon codicon-clear-all" />
                                                                        <span>Unassigned</span>
                                                                    </div>
 
                                                                    {/* Agent Listing */}
                                                                    {agents.filter(a => a.name.toLowerCase().includes(agentSearchQuery.toLowerCase())).length > 0 && (
                                                                        <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '6px 8px 2px' }}>
                                                                            Agents
                                                                        </div>
                                                                    )}
                                                                    {agents
                                                                        .filter(a => a.name.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                                                                        .map(a => (
                                                                            <div
                                                                                key={`popover-agent-${a.id}`}
                                                                                onClick={() => handleSelectAgentOrWorkflow(index, a.name)}
                                                                                style={{
                                                                                    padding: '6px 8px',
                                                                                    fontSize: '11px',
                                                                                    color: 'white',
                                                                                    cursor: 'pointer',
                                                                                    borderRadius: '4px',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'space-between',
                                                                                    transition: 'background 0.15s'
                                                                                }}
                                                                                onMouseOver={e => e.currentTarget.style.background = 'rgba(129, 140, 248, 0.15)'}
                                                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                            >
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span className="codicon codicon-hubot" style={{ color: '#818cf8' }} />
                                                                                    <span>{a.name}</span>
                                                                                </div>
                                                                                {step.agent === a.name && <span className="codicon codicon-check" style={{ color: '#34d399', fontSize: '10px' }} />}
                                                                            </div>
                                                                        ))}
 
                                                                    {/* Workflows Listing */}
                                                                    {workflows.filter(w => w.name.toLowerCase().includes(agentSearchQuery.toLowerCase())).length > 0 && (
                                                                        <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', padding: '6px 8px 2px', marginTop: '4px' }}>
                                                                            Workflows
                                                                        </div>
                                                                    )}
                                                                    {workflows
                                                                        .filter(w => w.name.toLowerCase().includes(agentSearchQuery.toLowerCase()))
                                                                        .map(w => {
                                                                            const flowValue = `Workflow: ${w.name}`;
                                                                            return (
                                                                                <div
                                                                                    key={`popover-flow-${w.id}`}
                                                                                    onClick={() => handleSelectAgentOrWorkflow(index, flowValue)}
                                                                                    style={{
                                                                                        padding: '6px 8px',
                                                                                        fontSize: '11px',
                                                                                        color: 'white',
                                                                                        cursor: 'pointer',
                                                                                        borderRadius: '4px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'space-between',
                                                                                        transition: 'background 0.15s'
                                                                                    }}
                                                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(234, 88, 12, 0.15)'}
                                                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                                                >
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                        <span className="codicon codicon-git-merge" style={{ color: '#ea580c' }} />
                                                                                        <span>{w.name}</span>
                                                                                    </div>
                                                                                    {step.agent === flowValue && <span className="codicon codicon-check" style={{ color: '#34d399', fontSize: '10px' }} />}
                                                                                </div>
                                                                            );
                                                                        })}
 
                                                                    {/* Fallback if no options match search */}
                                                                    {agents.filter(a => a.name.toLowerCase().includes(agentSearchQuery.toLowerCase())).length === 0 &&
                                                                     workflows.filter(w => w.name.toLowerCase().includes(agentSearchQuery.toLowerCase())).length === 0 && (
                                                                        <div style={{ padding: '12px 8px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontStyle: 'italic' }}>
                                                                            No matching results
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
 
                                                    {/* Render Notes */}
                                                    {step.notes && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255, 255, 255, 0.4)' }}>
                                                            <span className="codicon codicon-info" style={{ color: '#fb923c' }} />
                                                            <span>Note: {step.notes}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    {!isEditing && (
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            <button onClick={() => handleMoveStep(index, 'up')} disabled={index === 0} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: index === 0 ? 'default' : 'pointer', padding: '4px', opacity: index === 0 ? 0.2 : 1 }}>
                                                <span className="codicon codicon-arrow-up" />
                                            </button>
                                            <button onClick={() => handleMoveStep(index, 'down')} disabled={index === plan.steps.length - 1} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: index === plan.steps.length - 1 ? 'default' : 'pointer', padding: '4px', opacity: index === plan.steps.length - 1 ? 0.2 : 1 }}>
                                                <span className="codicon codicon-arrow-down" />
                                            </button>
                                            <button onClick={() => handleStartEdit(index, step)} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '4px' }}>
                                                <span className="codicon codicon-edit" />
                                            </button>
                                            <button onClick={() => handleDeleteStep(index)} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '4px' }} onMouseOver={e => e.currentTarget.style.color = '#f87171'} onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                                                <span className="codicon codicon-trash" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={handleAddStep}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px dashed rgba(255, 255, 255, 0.1)',
                                borderRadius: '10px',
                                color: 'rgba(255, 255, 255, 0.5)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '13px',
                                marginTop: '8px'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(129, 140, 248, 0.05)';
                                e.currentTarget.style.borderColor = '#818cf8';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                            }}
                        >
                            <span className="codicon codicon-add" />
                            Add Roadmap Step
                        </button>
                    </div>
                )}

                {activeTab === 'doc' && (() => {
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
                                                    ? 'rgba(30, 41, 59, 0.85)' // Slate gradient highlights
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
                })()}
                {['planning', 'tradeoffs', 'consequences'].includes(activeTab) && (() => {
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

                            {/* Sub-tabs Navigation */}
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

                            {/* Sub-tab Content Area */}
                            {activeTab === 'planning' && planningSubTab === 'blueprints' && isDetailedPlanningLoading ? (
                                // Premium Loading Skeleton Screen
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
                            ) : activeTab === 'planning' && planningSubTab === 'blueprints' && (!cleanPlanning || !cleanPlanning.trim()) ? (
                                // Premium Empty State
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
                            ) : (
                                // Active editor container
                                <div 
                                    ref={containerRef}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        minHeight: '300px'
                                    }}
                                >
                                    {/* Left Content Column */}
                                    {activeTab === 'planning' && planningSubTab === 'blueprints' ? (
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
                                    ) : (activeTab === 'tradeoffs' || (activeTab === 'planning' && planningSubTab === 'tradeoffs')) ? (
                                        <div style={{ 
                                            marginRight: showPlanningCommentsRoom ? '320px' : '0',
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '32px',
                                            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} className="tradeoffs-container">
                                            <div style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                                                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="codicon codicon-law" style={{ color: '#38bdf8' }} /> <span style={{ color: '#38bdf8' }}>Trade-offs</span> & Design Options
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            const newTradeoff = { task: 'New Option / Choice', considerations: 'Pros and cons considerations...', decision: 'Chosen option and rationale...' };
                                                            if (activeTab === 'planning') {
                                                                savePlan({ ...plan, planningTradeoffs: [...(plan.planningTradeoffs || []), newTradeoff] });
                                                            } else {
                                                                savePlan({ ...plan, tradeoffs: [...(plan.tradeoffs || []), newTradeoff] });
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                                    >
                                                        <span className="codicon codicon-add" /> Add Option
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    {((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || []).map((tradeoff, i) => {
                                                        return (
                                                            <div key={i} style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '12px',
                                                                position: 'relative',
                                                                borderBottom: i < ((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || []).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                                paddingBottom: i < ((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || []).length - 1 ? '16px' : '0'
                                                            }}>
                                                                <div id={getTargetIdForField(tradeoff.task)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', marginRight: '24px' }}>
                                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: '3px' }}>Option:</span>
                                                                        <textarea
                                                                            value={tradeoff.task}
                                                                            onChange={e => {
                                                                                const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                                updated[i] = { ...updated[i], task: e.target.value };
                                                                                if (activeTab === 'planning') {
                                                                                    setPlan({ ...plan, planningTradeoffs: updated });
                                                                                } else {
                                                                                    setPlan({ ...plan, tradeoffs: updated });
                                                                                }
                                                                            }}
                                                                            onBlur={e => {
                                                                                const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                                updated[i] = { ...updated[i], task: e.target.value.trim() };
                                                                                if (activeTab === 'planning') {
                                                                                    savePlan({ ...plan, planningTradeoffs: updated });
                                                                                } else {
                                                                                    savePlan({ ...plan, tradeoffs: updated });
                                                                                }
                                                                                e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                            }}
                                                                            onSelect={handleTextareaSelect}
                                                                            onMouseUp={handleTextareaMouseUp}
                                                                            ref={el => {
                                                                                if (el) {
                                                                                    el.style.height = 'auto';
                                                                                    el.style.height = el.scrollHeight + 'px';
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                background: 'transparent',
                                                                                border: 'none',
                                                                                borderBottom: '1px solid transparent',
                                                                                color: 'white',
                                                                                fontSize: '13.5px',
                                                                                fontWeight: 600,
                                                                                outline: 'none',
                                                                                width: '100%',
                                                                                resize: 'none',
                                                                                padding: '2px 0',
                                                                                fontFamily: 'inherit',
                                                                                transition: 'border-bottom-color 0.2s'
                                                                            }}
                                                                            onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = ((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || []).filter((_, idx) => idx !== i);
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningTradeoffs: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, tradeoffs: updated });
                                                                            }
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px' }}
                                                                        title="Delete Option"
                                                                        onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                                                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                                                    >
                                                                        <span className="codicon codicon-trash" style={{ fontSize: '13px' }} />
                                                                    </button>
                                                                </div>

                                                                <div id={getTargetIdForField(tradeoff.considerations)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Considerations:</span>
                                                                    <textarea
                                                                        value={tradeoff.considerations}
                                                                        onChange={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                            updated[i] = { ...updated[i], considerations: e.target.value };
                                                                            if (activeTab === 'planning') {
                                                                                setPlan({ ...plan, planningTradeoffs: updated });
                                                                            } else {
                                                                                setPlan({ ...plan, tradeoffs: updated });
                                                                            }
                                                                        }}
                                                                        onBlur={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                            updated[i] = { ...updated[i], considerations: e.target.value.trim() };
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningTradeoffs: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, tradeoffs: updated });
                                                                            }
                                                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                        }}
                                                                        onSelect={handleTextareaSelect}
                                                                        onMouseUp={handleTextareaMouseUp}
                                                                        ref={el => {
                                                                            if (el) {
                                                                                el.style.height = 'auto';
                                                                                el.style.height = el.scrollHeight + 'px';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            borderBottom: '1px solid transparent',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '13px',
                                                                            lineHeight: '1.5',
                                                                            outline: 'none',
                                                                            width: '100%',
                                                                            resize: 'none',
                                                                            padding: '2px 0',
                                                                            fontFamily: 'inherit',
                                                                            transition: 'border-bottom-color 0.2s'
                                                                        }}
                                                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                                                    />
                                                                </div>

                                                                <div id={getTargetIdForField(tradeoff.decision)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Decision:</span>
                                                                    <textarea
                                                                        value={tradeoff.decision}
                                                                        onChange={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                            updated[i] = { ...updated[i], decision: e.target.value };
                                                                            if (activeTab === 'planning') {
                                                                                setPlan({ ...plan, planningTradeoffs: updated });
                                                                            } else {
                                                                                setPlan({ ...plan, tradeoffs: updated });
                                                                            }
                                                                        }}
                                                                        onBlur={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || [])];
                                                                            updated[i] = { ...updated[i], decision: e.target.value.trim() };
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningTradeoffs: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, tradeoffs: updated });
                                                                            }
                                                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                        }}
                                                                        onSelect={handleTextareaSelect}
                                                                        onMouseUp={handleTextareaMouseUp}
                                                                        ref={el => {
                                                                            if (el) {
                                                                                el.style.height = 'auto';
                                                                                el.style.height = el.scrollHeight + 'px';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            borderBottom: '1px solid transparent',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '13px',
                                                                            lineHeight: '1.5',
                                                                            outline: 'none',
                                                                            width: '100%',
                                                                            resize: 'none',
                                                                            padding: '2px 0',
                                                                            fontFamily: 'inherit',
                                                                            transition: 'border-bottom-color 0.2s'
                                                                        }}
                                                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {((activeTab === 'planning' ? plan.planningTradeoffs : plan.tradeoffs) || []).length === 0 && (
                                                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No design tradeoffs documented</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ 
                                            marginRight: showPlanningCommentsRoom ? '320px' : '0',
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: '32px',
                                            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} className="tradeoffs-container">
                                            <div style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                                                    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="codicon codicon-warning" style={{ color: '#fb923c' }} /> <span style={{ color: '#fb923c' }}>Failure Modes</span> & Consequences
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            const newConsequence = { failureMode: 'New Failure Mode', consequence: 'Potential system consequence...', harm: 'Harm to system/user...', mitigation: 'Proposed guard/mitigation...' };
                                                            if (activeTab === 'planning') {
                                                                savePlan({ ...plan, planningConsequences: [...(plan.planningConsequences || []), newConsequence] });
                                                            } else {
                                                                savePlan({ ...plan, consequences: [...(plan.consequences || []), newConsequence] });
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                                    >
                                                        <span className="codicon codicon-add" /> Add Risk Analysis
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    {((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || []).map((consequence, i) => {
                                                        return (
                                                            <div key={i} style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: '12px',
                                                                position: 'relative',
                                                                borderBottom: i < ((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || []).length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                                paddingBottom: i < ((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || []).length - 1 ? '16px' : '0'
                                                            }}>
                                                                <div id={getTargetIdForField(consequence.failureMode)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', marginRight: '24px' }}>
                                                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: '3px' }}>Risk:</span>
                                                                        <textarea
                                                                            value={consequence.failureMode}
                                                                            onChange={e => {
                                                                                const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                                updated[i] = { ...updated[i], failureMode: e.target.value };
                                                                                if (activeTab === 'planning') {
                                                                                    setPlan({ ...plan, planningConsequences: updated });
                                                                                } else {
                                                                                    setPlan({ ...plan, consequences: updated });
                                                                                }
                                                                            }}
                                                                            onBlur={e => {
                                                                                const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                                updated[i] = { ...updated[i], failureMode: e.target.value.trim() };
                                                                                if (activeTab === 'planning') {
                                                                                    savePlan({ ...plan, planningConsequences: updated });
                                                                                } else {
                                                                                    savePlan({ ...plan, consequences: updated });
                                                                                }
                                                                                e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                            }}
                                                                            onSelect={handleTextareaSelect}
                                                                            onMouseUp={handleTextareaMouseUp}
                                                                            ref={el => {
                                                                                if (el) {
                                                                                    el.style.height = 'auto';
                                                                                    el.style.height = el.scrollHeight + 'px';
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                background: 'transparent',
                                                                                border: 'none',
                                                                                borderBottom: '1px solid transparent',
                                                                                color: 'white',
                                                                                fontSize: '13.5px',
                                                                                fontWeight: 600,
                                                                                outline: 'none',
                                                                                width: '100%',
                                                                                resize: 'none',
                                                                                padding: '2px 0',
                                                                                fontFamily: 'inherit',
                                                                                transition: 'border-bottom-color 0.2s'
                                                                            }}
                                                                            onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            const updated = ((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || []).filter((_, idx) => idx !== i);
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, consequences: updated });
                                                                            }
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '4px' }}
                                                                        title="Delete Risk"
                                                                        onMouseOver={e => e.currentTarget.style.color = '#f87171'}
                                                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                                                    >
                                                                        <span className="codicon codicon-trash" style={{ fontSize: '13px' }} />
                                                                    </button>
                                                                </div>

                                                                <div id={getTargetIdForField(consequence.consequence)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Consequence:</span>
                                                                    <textarea
                                                                        value={consequence.consequence}
                                                                        onChange={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], consequence: e.target.value };
                                                                            if (activeTab === 'planning') {
                                                                                setPlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                setPlan({ ...plan, consequences: updated });
                                                                            }
                                                                        }}
                                                                        onBlur={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], consequence: e.target.value.trim() };
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, consequences: updated });
                                                                            }
                                                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                        }}
                                                                        onSelect={handleTextareaSelect}
                                                                        onMouseUp={handleTextareaMouseUp}
                                                                        ref={el => {
                                                                            if (el) {
                                                                                el.style.height = 'auto';
                                                                                el.style.height = el.scrollHeight + 'px';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            borderBottom: '1px solid transparent',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '13px',
                                                                            lineHeight: '1.5',
                                                                            outline: 'none',
                                                                            width: '100%',
                                                                            resize: 'none',
                                                                            padding: '2px 0',
                                                                            fontFamily: 'inherit',
                                                                            transition: 'border-bottom-color 0.2s'
                                                                        }}
                                                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                                                    />
                                                                </div>

                                                                <div id={getTargetIdForField(consequence.harm)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Harm:</span>
                                                                    <textarea
                                                                        value={consequence.harm}
                                                                        onChange={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], harm: e.target.value };
                                                                            if (activeTab === 'planning') {
                                                                                setPlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                setPlan({ ...plan, consequences: updated });
                                                                            }
                                                                        }}
                                                                        onBlur={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], harm: e.target.value.trim() };
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, consequences: updated });
                                                                            }
                                                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                        }}
                                                                        onSelect={handleTextareaSelect}
                                                                        onMouseUp={handleTextareaMouseUp}
                                                                        ref={el => {
                                                                            if (el) {
                                                                                el.style.height = 'auto';
                                                                                el.style.height = el.scrollHeight + 'px';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            borderBottom: '1px solid transparent',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '13px',
                                                                            lineHeight: '1.5',
                                                                            outline: 'none',
                                                                            width: '100%',
                                                                            resize: 'none',
                                                                            padding: '2px 0',
                                                                            fontFamily: 'inherit',
                                                                            transition: 'border-bottom-color 0.2s'
                                                                        }}
                                                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                                                    />
                                                                </div>

                                                                <div id={getTargetIdForField(consequence.mitigation)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>Mitigation:</span>
                                                                    <textarea
                                                                        value={consequence.mitigation}
                                                                        onChange={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], mitigation: e.target.value };
                                                                            if (activeTab === 'planning') {
                                                                                setPlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                setPlan({ ...plan, consequences: updated });
                                                                            }
                                                                        }}
                                                                        onBlur={e => {
                                                                            const updated = [...((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || [])];
                                                                            updated[i] = { ...updated[i], mitigation: e.target.value.trim() };
                                                                            if (activeTab === 'planning') {
                                                                                savePlan({ ...plan, planningConsequences: updated });
                                                                            } else {
                                                                                savePlan({ ...plan, consequences: updated });
                                                                            }
                                                                            e.currentTarget.style.borderBottom = '1px solid transparent';
                                                                        }}
                                                                        onSelect={handleTextareaSelect}
                                                                        onMouseUp={handleTextareaMouseUp}
                                                                        ref={el => {
                                                                            if (el) {
                                                                                el.style.height = 'auto';
                                                                                el.style.height = el.scrollHeight + 'px';
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            borderBottom: '1px solid transparent',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '13px',
                                                                            lineHeight: '1.5',
                                                                            outline: 'none',
                                                                            width: '100%',
                                                                            resize: 'none',
                                                                            padding: '2px 0',
                                                                            fontFamily: 'inherit',
                                                                            transition: 'border-bottom-color 0.2s'
                                                                        }}
                                                                        onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(255,255,255,0.1)'}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {((activeTab === 'planning' ? plan.planningConsequences : plan.consequences) || []).length === 0 && (
                                                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No security failure analysis documented</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Right: Floating Comments Column */}
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
                                                        ? 'rgba(30, 41, 59, 0.85)' // Slate gradient highlights
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
                                                                resize: 'none',
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
                            )}
                        </div>
                    );
                })()}

                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
                        {/* Expected Outcome */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '20px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="codicon codicon-target" style={{ color: '#818cf8' }} /> Expected Outcome
                                </h3>
                                {!isEditingExpectedOutcome ? (
                                    <button
                                        onClick={() => {
                                            setEditingExpectedOutcomeText(plan.expectedOutcome);
                                            setIsEditingExpectedOutcome(true);
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer' }}
                                    >
                                        <span className="codicon codicon-edit" />
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button onClick={() => setIsEditingExpectedOutcome(false)} style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px' }}>Cancel</button>
                                        <button onClick={handleSaveExpectedOutcome} style={{ background: '#818cf8', border: 'none', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Save</button>
                                    </div>
                                )}
                            </div>
                            {isEditingExpectedOutcome ? (
                                <textarea
                                    value={editingExpectedOutcomeText}
                                    onChange={e => setEditingExpectedOutcomeText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        outline: 'none',
                                        fontSize: '12.5px',
                                        resize: 'vertical'
                                    }}
                                />
                            ) : (
                                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.55 }}>{plan.expectedOutcome}</p>
                            )}
                        </div>

                        {/* Files lists */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Files to Read */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                padding: '20px',
                                backdropFilter: 'blur(8px)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="codicon codicon-book" style={{ color: '#38bdf8' }} /> Files to Read
                                    </h3>
                                    <button
                                        onClick={() => setShowAddRead(!showAddRead)}
                                        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
                                    >
                                        <span className="codicon codicon-add" />
                                    </button>
                                </div>

                                {showAddRead && (
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="src/filename.ts"
                                            value={newReadText}
                                            onChange={e => setNewReadText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddReadItem()}
                                            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                                        />
                                        <button onClick={handleAddReadItem} style={{ padding: '2px 8px', background: '#38bdf8', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {(plan.filesRead || []).map((file, i) => {
                                        const isEditingItem = editingReadIndex === i;
                                        return (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                padding: '6px 12px',
                                                borderRadius: '6px'
                                            }}>
                                                {isEditingItem ? (
                                                    <input
                                                        type="text"
                                                        value={editingReadText}
                                                        onChange={e => setEditingReadText(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveReadItem(i)}
                                                        onBlur={() => handleSaveReadItem(i)}
                                                        autoFocus
                                                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                                        <span className="codicon codicon-file" style={{ color: '#38bdf8' }} />
                                                        <span>{file}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setEditingReadText(file);
                                                            setEditingReadIndex(i);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReadItem(i)}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!plan.filesRead || plan.filesRead.length === 0) && (
                                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No files listed for reading</div>
                                    )}
                                </div>
                            </div>

                            {/* Files to Modify */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '12px',
                                padding: '20px',
                                backdropFilter: 'blur(8px)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="codicon codicon-edit" style={{ color: '#fb923c' }} /> Files to Modify
                                    </h3>
                                    <button
                                        onClick={() => setShowAddModify(!showAddModify)}
                                        style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer' }}
                                    >
                                        <span className="codicon codicon-add" />
                                    </button>
                                </div>

                                {showAddModify && (
                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="src/filename.ts"
                                            value={newModifyText}
                                            onChange={e => setNewModifyText(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddModifyItem()}
                                            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                                        />
                                        <button onClick={handleAddModifyItem} style={{ padding: '2px 8px', background: '#fb923c', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {(plan.filesToModify || []).map((file, i) => {
                                        const isEditingItem = editingModifyIndex === i;
                                        return (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                                padding: '6px 12px',
                                                borderRadius: '6px'
                                            }}>
                                                {isEditingItem ? (
                                                    <input
                                                        type="text"
                                                        value={editingModifyText}
                                                        onChange={e => setEditingModifyText(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveModifyItem(i)}
                                                        onBlur={() => handleSaveModifyItem(i)}
                                                        autoFocus
                                                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}
                                                    />
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                                        <span className="codicon codicon-edit" style={{ color: '#fb923c' }} />
                                                        <span>{file}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        onClick={() => {
                                                            setEditingModifyText(file);
                                                            setEditingModifyIndex(i);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteModifyItem(i)}
                                                        style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '2px' }}
                                                    >
                                                        <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!plan.filesToModify || plan.filesToModify.length === 0) && (
                                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No files listed for modification</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Testing / Verification Criteria */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '20px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="codicon codicon-beaker" style={{ color: '#c084fc' }} /> Verification & Testing Criteria
                                </h3>
                                <button
                                    onClick={() => setShowAddCrit(!showAddCrit)}
                                    style={{ background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer' }}
                                >
                                    <span className="codicon codicon-add" />
                                </button>
                            </div>

                            {showAddCrit && (
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="Ensure compilation passes..."
                                        value={newCritText}
                                        onChange={e => setNewCritText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddCritItem()}
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', outline: 'none' }}
                                    />
                                    <button onClick={handleAddCritItem} style={{ padding: '2px 8px', background: '#c084fc', border: 'none', borderRadius: '4px', color: '#0d1117', fontSize: '11px', fontWeight: 600 }}>Add</button>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(plan.verificationCriteria || []).map((crit, i) => {
                                    const isEditingItem = editingCritIndex === i;
                                    return (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            padding: '8px 14px',
                                            borderRadius: '6px'
                                        }}>
                                            {isEditingItem ? (
                                                <input
                                                    type="text"
                                                    value={editingCritText}
                                                    onChange={e => setEditingCritText(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleSaveCritItem(i)}
                                                    onBlur={() => handleSaveCritItem(i)}
                                                    autoFocus
                                                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', outline: 'none', fontSize: '12px' }}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                                                    <span className="codicon codicon-pass-filled" style={{ color: '#c084fc' }} />
                                                    <span>{crit}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingCritText(crit);
                                                        setEditingCritIndex(i);
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px' }}
                                                >
                                                    <span className="codicon codicon-edit" style={{ fontSize: '10px' }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCritItem(i)}
                                                    style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', padding: '2px' }}
                                                >
                                                    <span className="codicon codicon-trash" style={{ fontSize: '10px' }} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!plan.verificationCriteria || plan.verificationCriteria.length === 0) && (
                                    <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No verification criteria specified</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'flow' && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 100%)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        padding: '30px',
                        backdropFilter: 'blur(8px)',
                        gap: '32px',
                        width: '100%'
                    }}>
                        {plan.steps.length === 0 ? (
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Add steps to display the flowchart</div>
                        ) : (
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
                                {/* Roadmap Execution Flow */}
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="codicon codicon-git-compare" style={{ color: '#818cf8' }} /> Roadmap Execution Flow
                                    </h4>
                                    <svg width="100%" height={Math.max(300, plan.steps.length * 90)} style={{ maxWidth: '600px' }}>
                                        <defs>
                                            <linearGradient id="nodeGradCompleted" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="rgba(52, 211, 153, 0.15)" />
                                                <stop offset="100%" stopColor="rgba(5, 150, 105, 0.02)" />
                                            </linearGradient>
                                            <linearGradient id="nodeGradPending" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.03)" />
                                                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.005)" />
                                            </linearGradient>
                                            <linearGradient id="strokeGradCompleted" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#34d399" />
                                                <stop offset="100%" stopColor="#059669" />
                                            </linearGradient>
                                            <linearGradient id="strokeGradPending" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
                                                <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                                            </linearGradient>
                                            <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#818cf8" />
                                                <stop offset="100%" stopColor="#c084fc" />
                                            </linearGradient>
                                            <filter id="glow-active" x="-25%" y="-25%" width="150%" height="150%">
                                                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
                                            </filter>
                                            <filter id="glow-completed" x="-25%" y="-25%" width="150%" height="150%">
                                                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.3" />
                                            </filter>
                                            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#818cf8" />
                                            </marker>
                                            <marker id="arrow-completed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
                                            </marker>
                                        </defs>
                                        <style>{`
                                            @keyframes dash {
                                                to {
                                                    stroke-dashoffset: -40;
                                                }
                                            }
                                        `}</style>
                                        {plan.steps.map((step, idx) => {
                                            const y = 30 + idx * 90;
                                            const rectWidth = 240;
                                            const rectHeight = 50;
                                            const x = (600 - rectWidth) / 2;

                                            return (
                                                <g key={idx} className="node">
                                                    <rect
                                                        x={x}
                                                        y={y}
                                                        width={rectWidth}
                                                        height={rectHeight}
                                                        rx="8"
                                                        ry="8"
                                                        fill={step.completed ? 'url(#nodeGradCompleted)' : 'url(#nodeGradPending)'}
                                                        stroke={step.completed ? 'url(#strokeGradCompleted)' : 'url(#strokeGradPending)'}
                                                        strokeWidth="1.5"
                                                        filter={step.completed ? 'url(#glow-completed)' : 'none'}
                                                    />
                                                    <circle cx={x + 20} cy={y + 25} r="10" fill={step.completed ? 'rgba(52, 211, 153, 0.15)' : 'rgba(129, 140, 248, 0.15)'} />
                                                    <text x={x + 20} y={y + 28} textAnchor="middle" fill={step.completed ? '#34d399' : '#818cf8'} fontSize="10" fontWeight="bold">{step.order}</text>
                                                    
                                                    <text x={x + 40} y={y + 22} fill="white" fontWeight="600" fontSize="11">{step.action.toUpperCase()}</text>
                                                    <text x={x + 40} y={y + 38} fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="JetBrains Mono, monospace">{step.target.length > 25 ? step.target.slice(0, 25) + '...' : step.target}</text>

                                                    {idx < plan.steps.length - 1 && (
                                                        <path
                                                            d={`M 300,${y + rectHeight} L 300,${y + 90}`}
                                                            stroke={step.completed ? '#34d399' : '#818cf8'}
                                                            strokeWidth="1.5"
                                                            markerEnd={step.completed ? 'url(#arrow-completed)' : 'url(#arrow)'}
                                                            strokeDasharray={step.completed ? 'none' : '4, 4'}
                                                            style={{
                                                                animation: step.completed ? 'none' : 'dash 2s linear infinite',
                                                                opacity: step.completed ? 0.8 : 0.6
                                                            }}
                                                        />
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* Class & Module Dependency Visualizer */}
                                {plan.classDependencies && plan.classDependencies.length > 0 && (() => {
                                    const deps = plan.classDependencies || [];
                                    const declaredNames = new Set(deps.map(d => d.name));
                                    const allNodes = [...deps];

                                    // Identify external references dynamically
                                    const allDependsOn = new Set<string>();
                                    deps.forEach(d => {
                                        if (d.dependsOn) {
                                            d.dependsOn.forEach(depName => {
                                                if (depName && !declaredNames.has(depName)) {
                                                    allDependsOn.add(depName);
                                                }
                                            });
                                        }
                                    });

                                    allDependsOn.forEach(extName => {
                                        allNodes.push({
                                            name: extName,
                                            type: 'external',
                                            dependsOn: [],
                                            description: 'External dependency used by the plan classes.'
                                        });
                                    });

                                    const N = allNodes.length;
                                    const centerX = 300;
                                    const centerY = 190;
                                    const radius = 120;

                                    const nodeCoords: Record<string, { x: number; y: number }> = {};
                                    allNodes.forEach((node, idx) => {
                                        const angle = (idx * 2 * Math.PI) / (N || 1) - Math.PI / 2;
                                        nodeCoords[node.name] = {
                                            x: centerX + radius * Math.cos(angle),
                                            y: centerY + radius * Math.sin(angle)
                                        };
                                    });

                                    // Helper function to check relationship to hovered node
                                    const getRelationStatus = (nodeName: string) => {
                                        if (!hoveredNode) return 'normal';
                                        if (hoveredNode === nodeName) return 'hovered';
                                        
                                        const hoveredNodeData = allNodes.find(n => n.name === hoveredNode);
                                        if (hoveredNodeData?.dependsOn?.includes(nodeName)) {
                                            return 'provider'; // hoveredNode depends on nodeName
                                        }
                                        
                                        const thisNodeData = allNodes.find(n => n.name === nodeName);
                                        if (thisNodeData?.dependsOn?.includes(hoveredNode)) {
                                            return 'consumer'; // thisNodeData depends on hoveredNode
                                        }
                                        
                                        return 'dimmed';
                                    };

                                    const getTypeBadgeStyle = (type: string) => {
                                        switch (type.toLowerCase()) {
                                            case 'class':
                                                return { background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)' };
                                            case 'module':
                                                return { background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
                                            case 'service':
                                                return { background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)' };
                                            case 'interface':
                                                return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
                                            case 'external':
                                                return { background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255, 255, 255, 0.1)' };
                                            default:
                                                return { background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.3)' };
                                        }
                                    };

                                    return (
                                        <div style={{
                                            width: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                            paddingTop: '32px',
                                            alignItems: 'center'
                                        }}>
                                            <h4 style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="codicon codicon-symbol-class" style={{ color: '#f97316' }} /> Class & Module Dependencies
                                            </h4>
                                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', alignSelf: 'flex-start', marginBottom: '24px' }}>
                                                Interactive architecture visual model showing relationships between classes and interfaces. Hover elements to view structural relations.
                                            </span>

                                            <div style={{ display: 'flex', width: '100%', gap: '20px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {/* Left: SVG Diagram */}
                                                <svg width="100%" height="380" style={{ maxWidth: '600px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <defs>
                                                        <marker id="depArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(255,255,255,0.25)" />
                                                        </marker>
                                                        <marker id="depArrowHovered" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
                                                        </marker>
                                                        <marker id="depArrowProvider" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" />
                                                        </marker>
                                                        <marker id="depArrowConsumer" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#a855f7" />
                                                        </marker>
                                                    </defs>

                                                    {/* Connection Paths (rendered first so nodes draw on top) */}
                                                    {allNodes.map((node) => {
                                                        const fromPt = nodeCoords[node.name];
                                                        return (node.dependsOn || []).map((depName, dIdx) => {
                                                            const toPt = nodeCoords[depName];
                                                            if (!fromPt || !toPt) return null;

                                                            const dx = toPt.x - fromPt.x;
                                                            const dy = toPt.y - fromPt.y;
                                                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                                                            const ux = dx / dist;
                                                            const uy = dy / dist;

                                                            // Offset the lines to stop cleanly at node boundaries (120x30 capsule)
                                                            const borderFromX = fromPt.x + ux * 60;
                                                            const borderFromY = fromPt.y + uy * 15;
                                                            const borderToX = toPt.x - ux * 60;
                                                            const borderToY = toPt.y - uy * 15;

                                                            // Curve slightly toward center
                                                            const mx = (borderFromX + borderToX) / 2;
                                                            const my = (borderFromY + borderToY) / 2;
                                                            const ctrlX = mx + (centerX - mx) * 0.12;
                                                            const ctrlY = my + (centerY - my) * 0.12;

                                                            // Determine highlight state
                                                            const isHoveredSrc = hoveredNode === node.name;
                                                            const isHoveredTgt = hoveredNode === depName;
                                                            const isActivePath = hoveredNode !== null && (isHoveredSrc || isHoveredTgt);
                                                            const isDimmedPath = hoveredNode !== null && !isHoveredSrc && !isHoveredTgt;

                                                            let strokeColor = 'rgba(255, 255, 255, 0.15)';
                                                            let markerId = 'url(#depArrow)';
                                                            let strokeWidth = 1.2;

                                                            if (isActivePath) {
                                                                strokeWidth = 2;
                                                                if (isHoveredSrc) {
                                                                    strokeColor = '#a855f7'; // Flow color to provider
                                                                    markerId = 'url(#depArrowConsumer)';
                                                                } else {
                                                                    strokeColor = '#3b82f6'; // Flow color from provider
                                                                    markerId = 'url(#depArrowProvider)';
                                                                }
                                                            } else if (isDimmedPath) {
                                                                strokeColor = 'rgba(255, 255, 255, 0.04)';
                                                            }

                                                            return (
                                                                <path
                                                                    key={`${node.name}-${depName}-${dIdx}`}
                                                                    d={`M ${borderFromX},${borderFromY} Q ${ctrlX},${ctrlY} ${borderToX},${borderToY}`}
                                                                    stroke={strokeColor}
                                                                    strokeWidth={strokeWidth}
                                                                    fill="none"
                                                                    markerEnd={markerId}
                                                                    style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                                                                />
                                                            );
                                                        });
                                                    })}

                                                    {/* Nodes */}
                                                    {allNodes.map((node) => {
                                                        const coord = nodeCoords[node.name];
                                                        if (!coord) return null;

                                                        const status = getRelationStatus(node.name);
                                                        const rectW = 120;
                                                        const rectH = 30;

                                                        let opacity = 1;
                                                        let stroke = 'rgba(255, 255, 255, 0.08)';
                                                        let strokeWidth = '1';
                                                        let fill = 'rgba(15, 23, 42, 0.65)';

                                                        if (status === 'hovered') {
                                                            stroke = '#f97316';
                                                            strokeWidth = '1.8';
                                                            fill = 'rgba(249, 115, 22, 0.08)';
                                                        } else if (status === 'provider') {
                                                            stroke = '#3b82f6';
                                                            strokeWidth = '1.5';
                                                            fill = 'rgba(59, 130, 246, 0.08)';
                                                        } else if (status === 'consumer') {
                                                            stroke = '#a855f7';
                                                            strokeWidth = '1.5';
                                                            fill = 'rgba(168, 85, 247, 0.08)';
                                                        } else if (status === 'dimmed') {
                                                            opacity = 0.35;
                                                        }

                                                        // Stylings for specific types
                                                        const badgeStyle = getTypeBadgeStyle(node.type);

                                                        return (
                                                            <g
                                                                key={node.name}
                                                                onMouseEnter={() => setHoveredNode(node.name)}
                                                                onMouseLeave={() => setHoveredNode(null)}
                                                                style={{ cursor: 'pointer', opacity, transition: 'all 0.2s ease' }}
                                                            >
                                                                <rect
                                                                    x={coord.x - rectW / 2}
                                                                    y={coord.y - rectH / 2}
                                                                    width={rectW}
                                                                    height={rectH}
                                                                    rx="6"
                                                                    ry="6"
                                                                    fill={fill}
                                                                    stroke={stroke}
                                                                    strokeWidth={strokeWidth}
                                                                    style={{ backdropFilter: 'blur(10px)' }}
                                                                />
                                                                <text
                                                                    x={coord.x}
                                                                    y={coord.y + 4}
                                                                    textAnchor="middle"
                                                                    fill={status === 'hovered' ? '#ffffff' : 'rgba(255,255,255,0.85)'}
                                                                    fontSize="10"
                                                                    fontWeight="500"
                                                                    style={{ transition: 'fill 0.2s' }}
                                                                >
                                                                    {node.name.length > 18 ? node.name.slice(0, 16) + '..' : node.name}
                                                                </text>
                                                                {/* Minimalist dot indicator of node type on top right */}
                                                                <circle
                                                                    cx={coord.x + rectW / 2 - 6}
                                                                    cy={coord.y - rectH / 2 + 6}
                                                                    r="3.5"
                                                                    fill={badgeStyle.color}
                                                                    stroke="rgba(0,0,0,0.4)"
                                                                    strokeWidth="0.5"
                                                                />
                                                            </g>
                                                        );
                                                    })}
                                                </svg>

                                                {/* Right: Selected Node Detail Panel */}
                                                <div style={{
                                                    flex: 1,
                                                    minWidth: '220px',
                                                    maxWidth: '350px',
                                                    minHeight: '120px',
                                                    background: 'rgba(15, 23, 42, 0.4)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderRadius: '10px',
                                                    padding: '16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: hoveredNode ? 'flex-start' : 'center',
                                                    alignItems: hoveredNode ? 'stretch' : 'center',
                                                    boxSizing: 'border-box'
                                                }}>
                                                    {hoveredNode ? (
                                                        (() => {
                                                            const node = allNodes.find(n => n.name === hoveredNode);
                                                            if (!node) return null;
                                                            const depsOn = node.dependsOn || [];
                                                            const depOf = allNodes.filter(n => n.dependsOn?.includes(hoveredNode)).map(n => n.name);
                                                            const badgeStyle = getTypeBadgeStyle(node.type);

                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                                                        <span style={{
                                                                            fontWeight: 600,
                                                                            fontSize: '8px',
                                                                            padding: '2px 6px',
                                                                            borderRadius: '8px',
                                                                            textTransform: 'uppercase',
                                                                            letterSpacing: '0.05em',
                                                                            ...badgeStyle
                                                                        }}>
                                                                            {node.type}
                                                                        </span>
                                                                        <strong style={{ color: 'white', fontSize: '12px', wordBreak: 'break-all' }}>{node.name}</strong>
                                                                    </div>
                                                                    <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
                                                                        {node.description}
                                                                    </p>
                                                                    {(depsOn.length > 0 || depOf.length > 0) && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', fontSize: '10px', marginTop: '4px' }}>
                                                                            {depsOn.length > 0 && (
                                                                                <div style={{ color: 'rgba(255,255,255,0.4)', wordBreak: 'break-word' }}>
                                                                                    Depends on: <span style={{ color: '#3b82f6', fontWeight: 500 }}>{depsOn.join(', ')}</span>
                                                                                </div>
                                                                            )}
                                                                            {depOf.length > 0 && (
                                                                                <div style={{ color: 'rgba(255,255,255,0.4)', wordBreak: 'break-word' }}>
                                                                                    Used by: <span style={{ color: '#a855f7', fontWeight: 500 }}>{depOf.join(', ')}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255, 255, 255, 0.35)', textAlign: 'center' }}>
                                                            <span className="codicon codicon-info" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.2)' }} />
                                                            <span style={{ fontSize: '11px' }}>Hover nodes to inspect relationships and detail documentation</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Inline AI Modifier Bar - Glassmorphic Bottom Panel */}
            {inlineAiError && (
                <div style={{
                    margin: '0 24px 8px',
                    padding: '8px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    color: '#f87171',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0
                }}>
                    <span className="codicon codicon-error" />
                    {inlineAiError}
                </div>
            )}
            {(activeTab === 'doc' || activeTab === 'steps') && <div style={{
                padding: '18px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                background: 'rgba(13, 17, 23, 0.8)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="codicon codicon-sparkle" style={{ color: '#818cf8', fontSize: '13px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'white', letterSpacing: '-0.01em' }}>Modify Plan with AI</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="e.g., Add a test step, change target database to PostgreSQL, assign DevOpsAgent..."
                        value={aiInstructions}
                        onChange={e => setAiInstructions(e.target.value)}
                        disabled={isAiLoading}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleModifyWithAI();
                        }}
                        style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: 'white',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '13px',
                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.6)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                    />
                    <button
                        onClick={handleModifyWithAI}
                        disabled={isAiLoading || !aiInstructions.trim()}
                        style={{
                            padding: '8px 18px',
                            background: isAiLoading || !aiInstructions.trim() ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: isAiLoading || !aiInstructions.trim() ? 'rgba(255, 255, 255, 0.3)' : 'white',
                            cursor: isAiLoading || !aiInstructions.trim() ? 'default' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isAiLoading || !aiInstructions.trim() ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isAiLoading ? (
                            <>
                                <span className="codicon codicon-loading codicon-modifier-spin" />
                                Modifying...
                            </>
                        ) : (
                            <>
                                <span className="codicon codicon-sparkle" />
                                Apply
                            </>
                        )}
                    </button>
                </div>
            </div>}

            {selectedTextInfo && showSelectionPopup && (
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
            )}
        </div>
    );
}
