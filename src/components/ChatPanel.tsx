import { useState, useEffect, useRef } from 'react';
import { executeWorkflow, WorkflowAction } from '../utils/workflowExecutor';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cleanAndExtractJSONObjects, mergeExecutionPlans, parsePartialJSON } from '../utils/jsonParser';
import { ContextMenu } from './ContextMenu';

const DollarIcon = ({ active, width = 13, height = 13, marginRight = 0 }: { active: boolean; width?: number; height?: number; marginRight?: number }) => (
    <svg 
        width={width} 
        height={height} 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        style={{ 
            transition: "all 0.3s ease",
            marginRight,
            color: active ? "#a78bfa" : "var(--text-secondary)",
            filter: active ? "drop-shadow(0 0 3px rgba(167, 139, 250, 0.6))" : "none"
        }}
    >
        <path fillRule="evenodd" d="M9 15a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm3.845-1.855a2.4 2.4 0 0 1 1.2-1.226 1 1 0 0 1 1.992-.026c.426.15.809.408 1.111.749a1 1 0 1 1-1.496 1.327.682.682 0 0 0-.36-.213.997.997 0 0 1-.113-.032.4.4 0 0 0-.394.074.93.93 0 0 0 .455.254 2.914 2.914 0 0 1 1.504.9c.373.433.669 1.092.464 1.823a.996.996 0 0 1-.046.129c-.226.519-.627.94-1.132 1.192a1 1 0 0 1-1.956.093 2.68 2.68 0 0 1-1.227-.798 1 1 0 1 1 1.506-1.315.682.682 0 0 0 .363.216c.038.009.075.02.111.032a.4.4 0 0 0 .395-.074.93.93 0 0 0-.455-.254 2.91 2.91 0 0 1-1.503-.9c-.375-.433-.666-1.089-.466-1.817a.994.994 0 0 1 .047-.134Zm1.884.573.003.008c-.003-.005-.003-.008-.003-.008Zm.55 2.613s-.002-.002-.003-.007a.032.032 0 0 1 .003.007ZM4 14a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Zm3-2a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm6.5-8a1 1 0 0 1 1-1H18a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.796l-2.341 2.049a1 1 0 0 1-1.24.06l-2.894-2.066L6.614 9.29a1 1 0 1 1-1.228-1.578l4.5-3.5a1 1 0 0 1 1.195-.025l2.856 2.04L15.34 5h-.84a1 1 0 0 1-1-1Z" clipRule="evenodd"/>
    </svg>
);

const CredentialBadge = ({ status }: { status?: { hasKey: boolean; encryptionAvailable: boolean } }) => {
    if (!status || !status.hasKey) {
        return (
            <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10, 
                color: 'var(--text-secondary)', 
                background: 'rgba(255,255,255,0.03)', 
                padding: '1px 5px', 
                borderRadius: 4,
                fontWeight: 500,
                opacity: 0.7
            }}>
                <span className="codicon codicon-circle-outline" style={{ fontSize: 9 }} /> Not Set
            </span>
        );
    }
    if (!status.encryptionAvailable) {
        return (
            <span style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10, 
                color: '#f59e0b', 
                background: 'rgba(245,158,11,0.08)', 
                padding: '1px 5px', 
                borderRadius: 4,
                fontWeight: 500
            }}>
                <span className="codicon codicon-warning" style={{ fontSize: 9 }} /> Plaintext
            </span>
        );
    }
    return (
        <span style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10, 
            color: '#34d399', 
            background: 'rgba(52,211,153,0.08)', 
            padding: '1px 5px', 
            borderRadius: 4,
            fontWeight: 500
        }}>
            <span className="codicon codicon-lock" style={{ fontSize: 9 }} /> Encrypted
        </span>
    );
};

export interface AppAgent {
    id: number;
    name: string;
    system_prompt?: string;
}

export interface AppFlow {
    id: number;
    name: string;
    description?: string;
    steps?: any;
}

export interface AppExecutionContext {
    agent: AppAgent;
    flow: AppFlow;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyCode?: (code: string) => void;
    executionContext?: AppExecutionContext | null;
    settingsSavedTrigger?: number;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
}

export interface ActivityTimelineItem {
    type: 'search' | 'analyze' | 'edit';
    query?: string;
    resultsCount?: number;
    filePath?: string;
    lineRange?: string;
    additions?: number;
    deletions?: number;
    timestamp: number;
}

interface Message {
    id?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isPlanMode?: boolean;
    isStreaming?: boolean;
    isAgentExecution?: boolean;
    filesRead?: string[];
    planSteps?: any[];
    activities?: ActivityTimelineItem[];
}

export function getNumericTaskId(conversationId: string): number {
    if (!conversationId) return 1;
    // Generate a stable 32-bit integer hash from the entire conversation ID string using DJB2
    let hash = 5381;
    for (let i = 0; i < conversationId.length; i++) {
        hash = (hash * 33) ^ conversationId.charCodeAt(i);
    }
    return Math.abs(hash) || 1;
}

const extractFiles = (text: string) => {
    if (!text) return [];
    const fileRegex = /([a-zA-Z0-9_\-\.\/]+\.(?:tsx?|jsx?|html|css|json|py|sh|md|yml|yaml|sql|ts))(?:\s*#L?(\d+)(?:-(\d+))?|\s*:L?(\d+)(?:-(\d+))?)?/gi;
    const matches: string[] = [];
    let match;
    fileRegex.lastIndex = 0;
    while ((match = fileRegex.exec(text)) !== null) {
        const filePath = match[1];
        if (filePath.toLowerCase().includes('http') || filePath.length <= 2) continue;
        
        let startLine: number | undefined;
        let endLine: number | undefined;
        
        if (match[2]) {
            startLine = parseInt(match[2], 10);
            if (match[3]) {
                endLine = parseInt(match[3], 10);
            }
        } else if (match[4]) {
            startLine = parseInt(match[4], 10);
            if (match[5]) {
                endLine = parseInt(match[5], 10);
            }
        }
        
        let fileRef = filePath;
        if (startLine) {
            fileRef += endLine ? `#L${startLine}-${endLine}` : `#L${startLine}`;
        }
        matches.push(fileRef);
    }
    return Array.from(new Set(matches));
};

interface ArchitecturalThinkingStep {
    order: number;
    action: string;
    target: string;
    rationale: string;
    notes?: string;
    agent?: string;
}

interface AssistantActivity {
    duration?: string;
    filesRead: string[];
    filesEdited: string[];
    thoughts?: string;
    planSteps?: ArchitecturalThinkingStep[];
    activities?: ActivityTimelineItem[];
}

function extractEditedFiles(text: string): string[] {
    const files: string[] = [];
    const codeBlockRegex = /```[a-zA-Z0-9_-]*\s*[\r\n]+([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const blockContent = match[1];
        const lines = blockContent.split('\n').slice(0, 3);
        for (const line of lines) {
            const fileMatch = line.match(new RegExp("(?:\\/\\/|#|\\/\\*)\\s*(?:File|Path|Target):\\s*([a-zA-Z0-9_\\-\\.\\/]+\\.[a-zA-Z0-9]+)", "i"));
            if (fileMatch) {
                files.push(fileMatch[1].trim());
                break;
            }
        }
    }
    return Array.from(new Set(files)).filter(f => !f.includes('http') && f.length > 2);
}

function parseAssistantResponse(content: string, conversationId?: string, isPlanMode?: boolean, isStreaming?: boolean): {
    activity: AssistantActivity | null;
    cleanContent: string;
} {
    let cleanContent = content;
    let activity: AssistantActivity | null = null;

    // 1. Check for CHAT_METADATA
    const metaStart = cleanContent.indexOf('[CHAT_METADATA_START]');
    const metaEnd = cleanContent.indexOf('[CHAT_METADATA_END]');
    if (metaStart !== -1 && metaEnd !== -1 && metaEnd > metaStart) {
        const jsonStr = cleanContent.substring(metaStart + 21, metaEnd);
        cleanContent = cleanContent.substring(0, metaStart) + cleanContent.substring(metaEnd + 19);
        try {
            const parsed = JSON.parse(jsonStr);
            activity = {
                duration: parsed.duration,
                filesRead: parsed.filesRead || [],
                filesEdited: parsed.filesEdited || [],
                thoughts: parsed.thoughts || '',
                activities: parsed.activities || []
            };
        } catch (e) {
            console.error('Failed to parse chat message metadata:', e);
        }
    } else if (metaStart !== -1 && metaEnd === -1) {
        // Partial metadata block still streaming — strip it so raw JSON doesn't leak
        cleanContent = cleanContent.substring(0, metaStart);
    }

    // 2. Check for ARCHITECTURAL_THINKING
    const thinkStart = cleanContent.indexOf('[ARCHITECTURAL_THINKING_START]');
    const thinkEnd = cleanContent.indexOf('[ARCHITECTURAL_THINKING_END]');
    if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
        const jsonStr = cleanContent.substring(thinkStart + 30, thinkEnd);
        cleanContent = cleanContent.substring(0, thinkStart) + cleanContent.substring(thinkEnd + 28);
        try {
            const parsed = JSON.parse(jsonStr);
            activity = {
                duration: parsed.duration,
                filesRead: parsed.files || parsed.filesRead || [],
                filesEdited: parsed.filesEdited || [],
                thoughts: parsed.expectedOutcome || '',
                planSteps: parsed.steps || []
            };
        } catch (e) {
            console.error('Failed to parse architectural thinking:', e);
        }
    } else if (thinkStart !== -1 && thinkEnd === -1) {
        // Partial architectural thinking block still streaming — strip it
        cleanContent = cleanContent.substring(0, thinkStart);
    }

    // 3. Extract <think> tags (if any)
    const thinkTagStart = cleanContent.indexOf('<think>');
    const thinkTagEnd = cleanContent.indexOf('</think>');
    if (thinkTagStart !== -1) {
        let extractedThoughts = '';
        if (thinkTagEnd !== -1 && thinkTagEnd > thinkTagStart) {
            extractedThoughts = cleanContent.substring(thinkTagStart + 7, thinkTagEnd).trim();
            cleanContent = cleanContent.substring(0, thinkTagStart) + cleanContent.substring(thinkTagEnd + 8);
        } else {
            extractedThoughts = cleanContent.substring(thinkTagStart + 7).trim();
            cleanContent = ''; // Currently streaming thoughts only
        }

        if (activity) {
            activity.thoughts = (activity.thoughts ? activity.thoughts + '\n' : '') + extractedThoughts;
        } else {
            activity = {
                filesRead: [],
                filesEdited: [],
                thoughts: extractedThoughts
            };
        }
    }

    // 4. Check if the message is raw plan JSON or contains a plan JSON structure
    const taskIdMatch = content.match(/plan:\/\/(\d+)/);
    let taskId = taskIdMatch ? parseInt(taskIdMatch[1], 10) : null;
    if (!taskId && conversationId) {
        taskId = getNumericTaskId(conversationId);
    }
    const alreadyHasPlanLink = /plan:\/\/\d+/i.test(cleanContent);
    const planSuffix = taskId && !alreadyHasPlanLink ? `\n\n[Click to Open Interactive Plan](plan://${taskId})` : '';

    // Scan for plan JSON blocks in cleanContent
    let planJsonStartIndex = -1;
    let parsedPlan: any = null;
    
    let searchPos = 0;
    while (true) {
        const braceIdx = cleanContent.indexOf('{', searchPos);
        if (braceIdx === -1) break;
        
        const candidateSub = cleanContent.substring(braceIdx);
        const parsed = parsePartialJSON(candidateSub);
        if (parsed && (parsed.steps || parsed.expectedOutcome || parsed.designDoc || parsed.duration || parsed.filesRead || parsed.filesToModify)) {
            planJsonStartIndex = braceIdx;
            parsedPlan = parsed;
            break;
        }
        searchPos = braceIdx + 1;
    }

    if (parsedPlan) {
        activity = {
            duration: parsedPlan.duration || activity?.duration,
            filesRead: parsedPlan.filesRead || parsedPlan.files || activity?.filesRead || [],
            filesEdited: parsedPlan.filesToModify || parsedPlan.filesEdited || activity?.filesEdited || [],
            thoughts: parsedPlan.expectedOutcome || activity?.thoughts || '',
            planSteps: parsedPlan.steps || activity?.planSteps || []
        };

        const textBeforeJson = cleanContent.substring(0, planJsonStartIndex).trim();
        if (textBeforeJson.length > 0) {
            if (isStreaming) {
                cleanContent = textBeforeJson;
            } else {
                cleanContent = `${textBeforeJson}\n\n**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.${planSuffix}`;
            }
        } else {
            if (isStreaming) {
                cleanContent = `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...\n\n**Expected Outcome:** ${parsedPlan.expectedOutcome || 'Planning...'}`;
            } else {
                cleanContent = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.${planSuffix}`;
            }
        }
    } else {
        if (!activity) {
            if (isPlanMode) {
                const parsed = parsePartialJSON(cleanContent);
                if (parsed) {
                    activity = {
                        duration: parsed.duration,
                        filesRead: parsed.filesRead || [],
                        filesEdited: parsed.filesToModify || [],
                        thoughts: parsed.expectedOutcome || '',
                        planSteps: parsed.steps || []
                    };
                    cleanContent = `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...\n\n**Expected Outcome:** ${parsed.expectedOutcome || 'Planning...'}`;
                }
            } else {
                const parsedObjects = cleanAndExtractJSONObjects(cleanContent);
                if (parsedObjects.length > 0) {
                    const merged = mergeExecutionPlans(parsedObjects);
                    if (merged && (merged.steps || merged.designDoc || merged.expectedOutcome)) {
                        activity = {
                            duration: merged.duration,
                            filesRead: merged.filesRead || [],
                            filesEdited: merged.filesToModify || [],
                            thoughts: merged.expectedOutcome || '',
                            planSteps: merged.steps || []
                        };
                        cleanContent = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.${planSuffix}`;
                    }
                }
            }
        } else if (activity.planSteps && activity.planSteps.length > 0 || cleanContent.trim().startsWith('{')) {
            const parsedObjects = cleanAndExtractJSONObjects(cleanContent);
            if (parsedObjects.length > 0) {
                const merged = mergeExecutionPlans(parsedObjects);
                if (merged && (merged.designDoc || merged.expectedOutcome)) {
                    cleanContent = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.${planSuffix}`;
                }
            } else if (activity.planSteps && activity.planSteps.length > 0) {
                cleanContent = `**Roadmap & Design Specifications** generated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.${planSuffix}`;
            }
        }
    }

    if (!activity || !activity.filesRead || activity.filesRead.length === 0) {
        const allFiles = extractFiles(content);
        const edited = extractEditedFiles(content);
        const viewed = allFiles.filter(f => !edited.includes(f));

        if (viewed.length > 0 || edited.length > 0) {
            if (!activity) {
                activity = {
                    filesRead: viewed,
                    filesEdited: edited,
                    thoughts: ''
                };
            } else {
                activity.filesRead = viewed;
                activity.filesEdited = edited;
            }
        }
    }

    if (isStreaming && !parsedPlan && (!activity || !activity.planSteps || activity.planSteps.length === 0)) {
        const trimmed = cleanContent.trim();
        if (trimmed.startsWith('{') || trimmed.includes('"steps"') || trimmed.includes('"designDoc"') || trimmed.includes('"expectedOutcome"')) {
            cleanContent = `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...`;
        }
    }

    cleanContent = cleanContent.trim();
    return { activity, cleanContent };
}



function ActivitySteps({ 
    activity,
    isStreaming = false,
    msgFilesRead = [],
    currentlyReadingFiles = [],
    streamElapsed = 0
}: { 
    activity: AssistantActivity;
    isStreaming?: boolean;
    msgFilesRead?: string[];
    currentlyReadingFiles?: { path: string; timestamp: number }[];
    streamElapsed?: number;
}) {
    const [isMainExpanded, setIsMainExpanded] = useState(isStreaming);
    const [isExploredExpanded, setIsExploredExpanded] = useState(true);

    useEffect(() => {
        setIsMainExpanded(isStreaming);
    }, [isStreaming]);

    // --- Build the unified step list ---
    const steps = (() => {
        // If we have explicit activities, use them
        if (activity.activities && activity.activities.length > 0) {
            const merged = [...activity.activities];

            if (isStreaming && currentlyReadingFiles && currentlyReadingFiles.length > 0) {
                const existingPaths = new Set(
                    activity.activities
                        .filter(a => a.type === 'analyze' && a.filePath)
                        .map(a => (a.filePath as string).replace(/\\/g, '/').toLowerCase())
                );

                currentlyReadingFiles.forEach(f => {
                    const normF = f.path.replace(/\\/g, '/').toLowerCase();
                    let found = false;
                    for (const existing of existingPaths) {
                        if (existing.endsWith(normF) || normF.endsWith(existing)) { found = true; break; }
                    }
                    if (!found) {
                        let cleanPath = f.path;
                        let lineRange = '';
                        const hashIdx = cleanPath.indexOf('#');
                        if (hashIdx !== -1) { cleanPath = f.path.substring(0, hashIdx); lineRange = f.path.substring(hashIdx); }
                        merged.push({ type: 'analyze', filePath: cleanPath, lineRange: lineRange || undefined, timestamp: f.timestamp || Date.now() });
                        existingPaths.add(cleanPath.replace(/\\/g, '/').toLowerCase());
                    }
                });
            }
            return merged;
        }

        // Backward compat / Plan Mode (build from planSteps and filesRead/Edited)
        const virtualSteps: ActivityTimelineItem[] = [];
        const seenFiles = new Set<string>();

        const baseFilesRead = activity.filesRead && activity.filesRead.length > 0
            ? activity.filesRead
            : (msgFilesRead && msgFilesRead.length > 0 ? msgFilesRead : []);

        baseFilesRead.forEach(file => {
            const norm = file.replace(/\\/g, '/').toLowerCase();
            if (!seenFiles.has(norm)) {
                seenFiles.add(norm);
                let cleanPath = file; let lineRange = '';
                const hashIdx = file.indexOf('#');
                if (hashIdx !== -1) { cleanPath = file.substring(0, hashIdx); lineRange = file.substring(hashIdx); }
                virtualSteps.push({ type: 'analyze', filePath: cleanPath, lineRange: lineRange || undefined, timestamp: 0 });
            }
        });

        (activity.filesEdited || []).forEach(file => {
            const norm = file.replace(/\\/g, '/').toLowerCase();
            if (!seenFiles.has(norm)) {
                seenFiles.add(norm);
            }
            virtualSteps.push({ type: 'edit', filePath: file, timestamp: 0 });
        });

        (activity.planSteps || []).forEach(step => {
            virtualSteps.push({
                type: 'plan' as any,
                query: step.action + (step.target ? ` on ${step.target}` : ''),
                timestamp: step.order
            });
        });

        return virtualSteps;
    })();

    // Build thinking info
    const hasThoughts = activity.thoughts && activity.thoughts.trim().length > 0;

    if (steps.length === 0 && !isStreaming && !hasThoughts) return null;

    const getFilename = (filePath: string) => filePath.split(/[/\\]/).pop() || filePath;

    const isActivelyReading = (filePath: string) => {
        if (!isStreaming || !currentlyReadingFiles) return false;
        const normP = filePath.replace(/\\/g, '/').toLowerCase();
        return currentlyReadingFiles.some(f => {
            const normF = f.path.replace(/\\/g, '/').toLowerCase();
            return normF.endsWith(normP) || normP.endsWith(normF);
        });
    };

    const getDurationString = () => {
        if (isStreaming) {
            return `${streamElapsed.toFixed(1)}s`;
        }
        if (!activity.duration) return '';
        if (/[a-zA-Z]/.test(activity.duration)) {
            return activity.duration;
        }
        const num = parseFloat(activity.duration);
        if (isNaN(num)) return activity.duration;
        if (num >= 60) {
            return `${Math.floor(num / 60)}m ${Math.round(num % 60)}s`;
        }
        return `${num.toFixed(1)}s`;
    };

    const handleFileClick = (filePath?: string) => {
        if (!filePath) return;
        window.dispatchEvent(new CustomEvent('open-workspace-file', {
            detail: { path: filePath }
        }));
    };

    const renderFileIcon = (filePath?: string) => {
        if (!filePath) return null;
        const ext = filePath.split('.').pop()?.toLowerCase();
        
        if (ext === 'tsx' || ext === 'jsx') {
            return (
                <svg 
                    width="12" 
                    height="12" 
                    viewBox="-11.5 -10.23174 23 20.46348" 
                    fill="none" 
                    stroke="#61dafb" 
                    strokeWidth="1.2" 
                    style={{ marginRight: '6px', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
                >
                    <circle cx="0" cy="0" r="2.05" fill="#61dafb"/>
                    <g stroke="#61dafb">
                        <ellipse rx="11" ry="4.2"/>
                        <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
                        <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
                    </g>
                </svg>
            );
        }
        
        if (ext === 'ts') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#3178c6',
                    color: 'white',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px',
                    lineHeight: '1',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    verticalAlign: 'middle'
                }}>TS</span>
            );
        }

        if (ext === 'js') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f7df1e',
                    color: 'black',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px',
                    lineHeight: '1',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    verticalAlign: 'middle'
                }}>JS</span>
            );
        }

        if (ext === 'css') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#264de4',
                    color: 'white',
                    fontSize: '7.5px',
                    fontWeight: 'bold',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px',
                    lineHeight: '1',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    verticalAlign: 'middle'
                }}>CSS</span>
            );
        }

        if (ext === 'html') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#e34f26',
                    color: 'white',
                    fontSize: '7.5px',
                    fontWeight: 'bold',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px',
                    lineHeight: '1',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    verticalAlign: 'middle'
                }}>HTML</span>
            );
        }

        if (ext === 'json') {
            return (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#fbc02d',
                    color: 'black',
                    fontSize: '7.5px',
                    fontWeight: 'bold',
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    marginRight: '6px',
                    lineHeight: '1',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    verticalAlign: 'middle'
                }}>{}</span>
            );
        }

        return <span className="codicon codicon-file" style={{ marginRight: '6px', fontSize: '12px', color: 'var(--text-secondary, rgba(255,255,255,0.4))', flexShrink: 0, verticalAlign: 'middle' }} />;
    };

    // Filter steps
    const searchSteps = steps.filter(s => s.type === 'search');
    const analyzeSteps = steps.filter(s => s.type === 'analyze');
    const editSteps = steps.filter(s => s.type === 'edit');
    const planSteps = steps.filter(s => (s.type as string) === 'plan');

    const uniqueFiles = Array.from(new Set(analyzeSteps.map(s => s.filePath?.replace(/\\/g, '/').toLowerCase()).filter(Boolean)));
    const uniqueFilesCount = uniqueFiles.length;
    const searchesCount = searchSteps.length;

    const durationStr = getDurationString();
    const mainHeader = isStreaming 
        ? `Working${durationStr ? ` (${durationStr})` : ''}`
        : `Worked${durationStr ? ` for ${durationStr}` : ''}`;

    const exploredHeader = isStreaming
        ? `Exploring...`
        : `Explored ${uniqueFilesCount} file${uniqueFilesCount !== 1 ? 's' : ''}, ${searchesCount} search${searchesCount !== 1 ? 'es' : ''}`;

    return (
        <div style={{ marginBottom: '8px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Thinking line (if thoughts exist) */}
            {hasThoughts && (
                <div style={{ 
                    padding: '2px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
                        {isStreaming ? 'Thinking' : 'Thought briefly'}
                    </span>
                </div>
            )}

            {/* Initial thinking state when no steps yet */}
            {isStreaming && steps.length === 0 && !hasThoughts && (
                <div style={{ 
                    padding: '2px 0', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>Thinking</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>...</span>
                </div>
            )}

            {/* Top-level collapsible: Worked for [duration] ▾ */}
            {steps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div
                        onClick={() => setIsMainExpanded(!isMainExpanded)}
                        style={{
                            padding: '2px 0',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            cursor: 'pointer',
                            userSelect: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                            fontWeight: 500
                        }}
                    >
                        <span style={{ color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>{mainHeader}</span>
                        <span style={{
                            fontSize: '9px',
                            color: 'var(--text-secondary, rgba(255,255,255,0.35))',
                            transition: 'transform 0.15s ease',
                            transform: isMainExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                            display: 'inline-block'
                        }}>▾</span>
                    </div>

                    {isMainExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {/* Explored collapsible section */}
                            {(searchSteps.length > 0 || analyzeSteps.length > 0 || isStreaming) && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    <div
                                        onClick={() => setIsExploredExpanded(!isExploredExpanded)}
                                        style={{
                                            padding: '2px 0',
                                            fontSize: '13px',
                                            lineHeight: '1.6',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))',
                                            fontWeight: 500
                                        }}
                                    >
                                        <span>{exploredHeader}</span>
                                        <span style={{
                                            fontSize: '9px',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.35))',
                                            transition: 'transform 0.15s ease',
                                            transform: isExploredExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            display: 'inline-block'
                                        }}>▾</span>
                                    </div>

                                    {isExploredExpanded && (
                                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                            {steps.filter(s => s.type !== 'edit' && (s.type as string) !== 'plan').map((step, idx) => {
                                                if (step.type === 'search') {
                                                    return (
                                                        <div key={idx} style={{ 
                                                            padding: '2px 0', 
                                                            fontSize: '13px', 
                                                            lineHeight: '1.6', 
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                                        }}>
                                                            <span style={{ marginRight: '6px' }}>Searched</span>
                                                            <span style={{ 
                                                                fontFamily: 'Consolas, Monaco, monospace', 
                                                                fontSize: '12px', 
                                                                color: 'var(--text-primary, rgba(255,255,255,0.85))',
                                                                background: 'rgba(255,255,255,0.03)',
                                                                padding: '1px 4px',
                                                                borderRadius: '3px'
                                                            }}>
                                                                {step.query}
                                                            </span>
                                                            {step.resultsCount !== undefined && (
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    color: 'var(--text-secondary, rgba(255,255,255,0.4))',
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '10px',
                                                                    marginLeft: '8px',
                                                                    fontWeight: 500
                                                                }}>
                                                                    {step.resultsCount} {step.resultsCount === 1 ? 'result' : 'results'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                if (step.type === 'analyze') {
                                                    const isActive = isActivelyReading(step.filePath || '');
                                                    return (
                                                        <div key={idx} style={{ 
                                                            padding: '2px 0', 
                                                            fontSize: '13px', 
                                                            lineHeight: '1.6', 
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                                        }}>
                                                            <span style={{ marginRight: '6px' }}>
                                                                {isActive ? 'Analyzing' : 'Analyzed'}
                                                            </span>
                                                            {renderFileIcon(step.filePath)}
                                                            <span 
                                                                onClick={() => handleFileClick(step.filePath)}
                                                                style={{ 
                                                                    color: 'var(--text-primary, rgba(255,255,255,0.85))',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                                            >
                                                                {getFilename(step.filePath || '')}
                                                            </span>
                                                            {step.lineRange && (
                                                                <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.4))', marginLeft: '4px', fontSize: '12px' }}>
                                                                    {step.lineRange.startsWith('#') || step.lineRange.startsWith(':') ? step.lineRange : `#${step.lineRange}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Planned steps */}
                            {planSteps.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    {planSteps.map((step, idx) => (
                                        <div key={idx} style={{ 
                                            padding: '2px 0', 
                                            fontSize: '13px', 
                                            lineHeight: '1.6', 
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                        }}>
                                            <span style={{ marginRight: '6px', fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.85))' }}>
                                                Planned
                                            </span>
                                            <span style={{ color: 'var(--text-secondary, rgba(255,255,255,0.55))' }}>
                                                {step.query}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Edited steps - siblings to Explored, indented by same amount (14px) */}
                            {editSteps.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px' }}>
                                    {editSteps.map((step, idx) => (
                                        <div key={idx} style={{ 
                                            padding: '2px 0', 
                                            fontSize: '13px', 
                                            lineHeight: '1.6', 
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'var(--text-secondary, rgba(255,255,255,0.55))' 
                                        }}>
                                            <span style={{ marginRight: '6px' }}>Edited</span>
                                            {renderFileIcon(step.filePath)}
                                            <span 
                                                onClick={() => handleFileClick(step.filePath)}
                                                style={{ 
                                                    color: 'var(--text-primary, rgba(255,255,255,0.85))',
                                                    cursor: 'pointer',
                                                    marginRight: '6px'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                {getFilename(step.filePath || '')}
                                            </span>
                                            {step.additions !== undefined && step.additions > 0 && (
                                                <span style={{ color: '#34d399', fontSize: '12px', marginRight: '4px', fontWeight: 600 }}>
                                                    +{step.additions}
                                                </span>
                                            )}
                                            {step.deletions !== undefined && step.deletions > 0 && (
                                                <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>
                                                    -{step.deletions}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}





type PlanActionMessage =
    | {
        kind: 'request';
        instructions: string;
    }
    | {
        kind: 'success';
        duration: string;
        description: string;
        taskId?: number;
    }
    | {
        kind: 'failure';
        duration: string;
        errorMessage: string;
    };

function parsePlanActionMessage(content: string): PlanActionMessage | null {
    if (!content) return null;

    const requestMatch = content.match(/\*{0,2}Plan Modification Request:?\*{0,2}:?\s*\n>\s*([\s\S]*)/i);
    if (requestMatch) {
        const instructions = requestMatch[1].replace(/^\s*>\s?/gm, '').trim();
        return instructions ? { kind: 'request', instructions } : null;
    }

    const successMatch = content.match(/\*{0,2}Plan Modified Successfully\*{0,2}\s*\(Took\s*([^)]+)\)\s*\n([\s\S]*?)(?:\n\n\[Click to Open Interactive Plan\]\(plan:\/\/(\d+)\))?\s*$/i);
    if (successMatch) {
        return {
            kind: 'success',
            duration: successMatch[1].trim(),
            description: successMatch[2].trim(),
            taskId: successMatch[3] ? parseInt(successMatch[3], 10) : undefined
        };
    }

    const failureMatch = content.match(/\*{0,2}Plan Modification Failed\*{0,2}\s*\(Took\s*([^)]+)\)\s*\n([\s\S]*)$/i);
    if (failureMatch) {
        return {
            kind: 'failure',
            duration: failureMatch[1].trim(),
            errorMessage: failureMatch[2].trim()
        };
    }

    return null;
}

function ChatMessageCard({
    msg,
    streamElapsed,
    currentlyReadingFiles,
    onApplyCode,
    onRollback,
    activeConversationId,
    onOpenPlan
}: {
    msg: Message;
    streamElapsed: number;
    currentlyReadingFiles: any[];
    onApplyCode?: (code: string) => void;
    onRollback: (messageId: number) => void;
    activeConversationId: string | null;
    onOpenPlan?: (taskId: number, taskTitle: string) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const [showCopied, setShowCopied] = useState(false);
    const planAction = parsePlanActionMessage(msg.content);
    const planTaskId = planAction?.kind === 'success'
        ? (planAction.taskId || (activeConversationId ? getNumericTaskId(activeConversationId) : undefined))
        : undefined;

    const handleCopy = () => {
        const { cleanContent } = parseAssistantResponse(msg.content, activeConversationId || undefined, msg.isPlanMode, msg.isStreaming);
        navigator.clipboard.writeText(cleanContent);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const isUser = msg.role === 'user';

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                alignSelf: isUser ? 'flex-end' : 'flex-start', 
                maxWidth: isUser ? '85%' : '100%',
                width: isUser ? 'auto' : '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Hover Actions Toolbar */}
            {isHovered && msg.id && (
                <div style={{
                    position: 'absolute',
                    bottom: '-12px',
                    right: isUser ? 'auto' : '8px',
                    left: isUser ? '8px' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    zIndex: 10
                }}>
                    <button
                        onClick={handleCopy}
                        title={showCopied ? "Copied!" : "Copy Message"}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: showCopied ? '#34d399' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '2px'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                    >
                        <span className={`codicon ${showCopied ? 'codicon-check' : 'codicon-copy'}`} style={{ fontSize: '11px' }} />
                    </button>
                    <button
                        onClick={() => onRollback(msg.id!)}
                        title="Reset conversation from this point"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '2px'
                        }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                            e.currentTarget.style.color = '#f43f5e';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <span className="codicon codicon-discard" style={{ fontSize: '11.5px' }} />
                    </button>
                </div>
            )}

            <div style={{
                background: isUser ? 'var(--accent-primary)' : 'transparent',
                color: isUser ? 'white' : 'var(--text-primary)',
                padding: isUser ? '8px 12px' : '8px 0',
                borderRadius: isUser ? 'var(--radius-md)' : '0px',
                fontSize: 'var(--font-base)',
                minWidth: isUser ? '80px' : '100%',
                border: 'none',
                boxShadow: 'none'
            }}>
                {isUser && !planAction ? (
                    /^[🔧⚙️✅❌]/.test(msg.content) || msg.content.includes('**Plan Modification Request**')
                        ? <MarkdownRenderer content={msg.content} onApplyCode={onApplyCode} />
                        : <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : planAction ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        minWidth: '320px',
                        maxWidth: '100%',
                        padding: '6px 2px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                                className={`codicon ${
                                    planAction.kind === 'request'
                                        ? 'codicon-tools'
                                        : planAction.kind === 'success'
                                            ? 'codicon-check'
                                            : 'codicon-error'
                                }`}
                                style={{
                                    color: planAction.kind === 'failure' ? '#f87171' : planAction.kind === 'success' ? '#34d399' : '#f59e0b',
                                    fontSize: '14px'
                                }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
                                    {planAction.kind === 'request'
                                        ? 'Plan update requested'
                                        : planAction.kind === 'success'
                                            ? `Plan updated in ${planAction.duration}`
                                            : `Plan update failed in ${planAction.duration}`}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)' }}>
                                    {planAction.kind === 'request'
                                        ? 'Background planning is running.'
                                        : planAction.kind === 'success'
                                            ? 'The interactive plan has been refreshed.'
                                            : 'The planner could not apply the requested changes.'}
                                </span>
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: 'rgba(255,255,255,0.82)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.55,
                            fontSize: '12.5px'
                        }}>
                            {planAction.kind === 'request' && planAction.instructions}
                            {planAction.kind === 'success' && planAction.description}
                            {planAction.kind === 'failure' && planAction.errorMessage}
                        </div>

                        {planAction.kind === 'success' && planTaskId && onOpenPlan && (
                            <button
                                onClick={() => onOpenPlan(planTaskId, `Task #${planTaskId}`)}
                                style={{
                                    alignSelf: 'flex-start',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(99, 102, 241, 0.35)',
                                    background: 'rgba(99, 102, 241, 0.12)',
                                    color: '#c7d2fe',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}
                            >
                                <span className="codicon codicon-link" style={{ fontSize: '11px' }} />
                                Open Interactive Plan
                            </button>
                        )}
                    </div>
                ) : msg.isAgentExecution ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '6px 4px',
                        minWidth: '320px',
                        maxWidth: '100%'
                    }}>
                        <style>{`
                            @keyframes cursor-blink {
                                0%, 49% { opacity: 1; }
                                50%, 100% { opacity: 0; }
                            }
                        `}</style>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span className="codicon codicon-play" style={{ color: '#34d399', fontSize: '14px' }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399', fontFamily: 'JetBrains Mono, monospace' }}>
                                System Agent Executing...
                            </span>
                        </div>
                        <div style={{
                            background: '#0d1117',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '11px',
                            color: 'rgba(255, 255, 255, 0.85)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.5',
                            textAlign: 'left'
                        }}>
                            {msg.content}
                            <span style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '12px',
                                background: '#34d399',
                                marginLeft: '4px',
                                verticalAlign: 'middle',
                                animation: 'cursor-blink 1s infinite'
                            }} />
                        </div>
                    </div>
                ) : (
                    (() => {
                        const { activity, cleanContent } = parseAssistantResponse(msg.content, activeConversationId || undefined, msg.isPlanMode, msg.isStreaming);
                        let finalActivity = activity;
                        if (finalActivity) {
                            if (!finalActivity.activities && msg.activities) {
                                finalActivity.activities = msg.activities;
                            }
                        } else if (msg.isStreaming || (msg.activities && msg.activities.length > 0)) {
                            finalActivity = {
                                filesRead: msg.filesRead || [],
                                filesEdited: [],
                                thoughts: '',
                                activities: msg.activities || []
                            };
                        }
                        return (
                            <>
                                <style>{`
                                    @keyframes cursor-blink {
                                        0%, 49% { opacity: 1; }
                                        50%, 100% { opacity: 0; }
                                    }
                                `}</style>
                                {finalActivity && (
                                    <ActivitySteps 
                                        activity={finalActivity} 
                                        isStreaming={msg.isStreaming}
                                        msgFilesRead={msg.filesRead} 
                                        currentlyReadingFiles={currentlyReadingFiles}
                                        streamElapsed={streamElapsed}
                                    />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                    <MarkdownRenderer content={cleanContent} onApplyCode={onApplyCode} />
                                    {msg.isStreaming && (
                                        <span style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '12px',
                                            background: '#818cf8',
                                            marginLeft: '4px',
                                            verticalAlign: 'middle',
                                            animation: 'cursor-blink 1s infinite'
                                        }} />
                                    )}
                                </div>
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
}

export function ChatPanel({ isOpen, onClose, onApplyCode, executionContext, settingsSavedTrigger, onOpenPlan }: ChatPanelProps) {
    const planStartTimeRef = useRef<number | null>(null);
    const planModifyAssistantMessageIdRef = useRef<number | null>(null);
    const [streamElapsed, setStreamElapsed] = useState<number>(0);
    const timerRef = useRef<any>(null);
    const [isPlanModifying, setIsPlanModifying] = useState(false);
    const [currentlyReadingFiles, setCurrentlyReadingFiles] = useState<{ path: string; timestamp: number }[]>([]);
    const currentActivitiesRef = useRef<ActivityTimelineItem[]>([]);

    useEffect(() => {
        const handleMainProcessMessage = (_event: any, data: any) => {
            if (!data) return;
            if (data.type === 'file-read') {
                const path = data.path;
                setCurrentlyReadingFiles(prev => {
                    if (prev.some(p => p.path === path)) return prev;
                    return [...prev.slice(-14), { path, timestamp: Date.now() }];
                });

                const normPath = path.replace(/\\/g, '/').toLowerCase();
                if (!currentActivitiesRef.current.some(a => a.type === 'analyze' && a.filePath?.replace(/\\/g, '/').toLowerCase() === normPath)) {
                    let cleanPath = path;
                    let lineRange = '';
                    const hashIdx = path.indexOf('#');
                    if (hashIdx !== -1) {
                        cleanPath = path.substring(0, hashIdx);
                        lineRange = path.substring(hashIdx);
                    } else {
                        const colonIdx = path.lastIndexOf(':');
                        if (colonIdx > 1 && /^\d+/.test(path.substring(colonIdx + 1))) {
                            cleanPath = path.substring(0, colonIdx);
                            lineRange = ':' + path.substring(colonIdx + 1);
                        }
                    }

                    const newItem: ActivityTimelineItem = {
                        type: 'analyze',
                        filePath: cleanPath,
                        lineRange: lineRange || undefined,
                        timestamp: data.timestamp || Date.now()
                    };
                    currentActivitiesRef.current = [...currentActivitiesRef.current, newItem];
                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                            return [...prev.slice(0, -1), {
                                ...lastMsg,
                                activities: currentActivitiesRef.current
                            }];
                        }
                        return prev;
                    });
                }
            } else if (data.type === 'file-search') {
                const newItem: ActivityTimelineItem = {
                    type: 'search',
                    query: data.query,
                    resultsCount: data.resultsCount,
                    timestamp: data.timestamp || Date.now()
                };
                currentActivitiesRef.current = [...currentActivitiesRef.current, newItem];
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                        return [...prev.slice(0, -1), {
                            ...lastMsg,
                            activities: currentActivitiesRef.current
                        }];
                    }
                    return prev;
                });
            } else if (data.type === 'file-write') {
                let cleanPath = data.path;
                let lineRange = '';
                const hashIdx = data.path.indexOf('#');
                if (hashIdx !== -1) {
                    cleanPath = data.path.substring(0, hashIdx);
                    lineRange = data.path.substring(hashIdx);
                } else {
                    const colonIdx = data.path.lastIndexOf(':');
                    if (colonIdx > 1 && /^\d+/.test(data.path.substring(colonIdx + 1))) {
                        cleanPath = data.path.substring(0, colonIdx);
                        lineRange = ':' + data.path.substring(colonIdx + 1);
                    }
                }

                const newItem: ActivityTimelineItem = {
                    type: 'edit',
                    filePath: cleanPath,
                    lineRange: lineRange || undefined,
                    additions: data.additions,
                    deletions: data.deletions,
                    timestamp: data.timestamp || Date.now()
                };
                currentActivitiesRef.current = [...currentActivitiesRef.current, newItem];
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
                        return [...prev.slice(0, -1), {
                            ...lastMsg,
                            activities: currentActivitiesRef.current
                        }];
                    }
                    return prev;
                });
            }
        };

        window.ipcRenderer.on('main-process-message', handleMainProcessMessage);
        return () => {
            window.ipcRenderer.off('main-process-message', handleMainProcessMessage);
        };
    }, []);

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

    const handleAbort = async () => {
        cleanupActiveListeners();
        try {
            window.ipcRenderer.send('ai:chat-abort');
        } catch (e) {
            console.error('Failed to send abort command', e);
        }

        setIsLoading(false);
        setIsPlanModifying(false);
        setMessageQueue([]);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setMessages(prev => {
            return prev.map(m => {
                if (m.isStreaming) {
                    return { ...m, isStreaming: false };
                }
                return m;
            });
        });
        
        setCurrentlyReadingFiles([]);
    };

    const [messages, setMessages] = useState<Message[]>([
        { role: 'system', content: 'You are a helpful coding assistant.' }
    ]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [conversationContextMenu, setConversationContextMenu] = useState<{ x: number; y: number; conv: any } | null>(null);

    const loadConversations = async () => {
        try {
            const convs = await window.ipcRenderer.invoke('chat:get-convs');
            setConversations(convs || []);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    };

    const getEnrichedMessages = async (convId: string): Promise<Message[]> => {
        const msgs = await window.ipcRenderer.invoke('chat:get-messages', convId);
        const enrichedMsgs = await Promise.all(msgs.map(async (msg: any) => {
            if (msg.role === 'assistant') {
                // Only enrich if the message content actually indicates a plan generation/planning message
                const isPlanningMessage = msg.content.includes('[ARCHITECTURAL_THINKING_START]') ||
                    msg.content.includes('**Roadmap & Design Specifications**') ||
                    msg.content.trim().startsWith('{');
                
                if (isPlanningMessage) {
                    const taskId = getNumericTaskId(convId);
                    try {
                        const res = await window.ipcRenderer.invoke('plan:get', taskId);
                        if (res && res.plan_json) {
                            const parsed = JSON.parse(res.plan_json);
                            return {
                                ...msg,
                                filesRead: parsed.filesRead || [],
                                planSteps: parsed.steps || []
                            };
                        }
                    } catch (e) {
                        console.error('Failed to load plan files for chat display:', e);
                    }
                }
            }
            return msg;
        }));
        return enrichedMsgs;
    };

    const refreshActiveMessages = async (convId: string, forceLastMessageStreaming = false) => {
        try {
            const enriched = await getEnrichedMessages(convId);
            if (enriched && enriched.length > 0) {
                if (forceLastMessageStreaming) {
                    const lastIdx = enriched.length - 1;
                    if (enriched[lastIdx].role === 'assistant') {
                        enriched[lastIdx] = {
                            ...enriched[lastIdx],
                            isStreaming: true
                        };
                    }
                }
                setMessages(enriched);
            } else {
                setMessages([
                    { role: 'system', content: 'You are a helpful coding assistant.' }
                ]);
            }
        } catch (err) {
            console.error('Failed to refresh active messages:', err);
        }
    };

    const handleRollbackConversation = async (messageId: number) => {
        if (!activeConversationId) return;
        try {
            const remainingMsgs = await window.ipcRenderer.invoke('chat:truncate-from-message', activeConversationId, messageId);
            
            let restoredPlanSaved = false;
            for (let i = remainingMsgs.length - 1; i >= 0; i--) {
                const msg = remainingMsgs[i];
                if (msg.role === 'assistant') {
                    let parsed: any = null;
                    const thinkStart = msg.content.indexOf('[ARCHITECTURAL_THINKING_START]');
                    const thinkEnd = msg.content.indexOf('[ARCHITECTURAL_THINKING_END]');
                    if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
                        const jsonStr = msg.content.substring(thinkStart + 30, thinkEnd);
                        try {
                            const meta = JSON.parse(jsonStr);
                            parsed = {
                                steps: meta.steps || [],
                                designDoc: meta.designDoc || '',
                                duration: meta.duration || '0.0',
                                filesRead: meta.files || [],
                                expectedOutcome: meta.expectedOutcome || '',
                                confidence: meta.confidence || 1.0
                            };
                        } catch (e) {
                            console.error('Failed to parse thinkingMeta during rollback:', e);
                        }
                    }

                    if (!parsed) {
                        const parsedObjects = cleanAndExtractJSONObjects(msg.content);
                        if (parsedObjects.length > 0) {
                            parsed = mergeExecutionPlans(parsedObjects);
                        }
                    }

                    if (parsed && (parsed.steps || parsed.designDoc)) {
                        const taskId = getNumericTaskId(activeConversationId);
                        await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(parsed));
                        restoredPlanSaved = true;
                        break;
                    }
                }
            }
            
            if (!restoredPlanSaved) {
                const taskId = getNumericTaskId(activeConversationId);
                const emptyPlan = {
                    steps: [],
                    designDoc: '',
                    duration: '0.0',
                    filesRead: [],
                    filesToModify: [],
                    expectedOutcome: ''
                };
                await window.ipcRenderer.invoke('plan:save', taskId, JSON.stringify(emptyPlan));
            }
            
            await refreshActiveMessages(activeConversationId);
            window.dispatchEvent(new CustomEvent('plan-reloaded'));
        } catch (err) {
            console.error('Failed to rollback conversation:', err);
        }
    };

    const handleSelectConversation = async (convId: string) => {
        try {
            setActiveConversationId(convId);
            await refreshActiveMessages(convId);
            
            // Find conversation model/provider
            const conv = conversations.find(c => c.id === convId);
            if (conv) {
                setActiveProvider(conv.provider);
                setActiveModel(conv.model);
            }
        } catch (err) {
            console.error('Failed to load conversation messages:', err);
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        try {
            await window.ipcRenderer.invoke('chat:delete-conv', convId);
            await loadConversations();
            if (activeConversationId === convId) {
                handleNewChat();
            }
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        }
    };

    const handleStartRename = (e: React.MouseEvent, conv: any) => {
        e.stopPropagation();
        setEditingConvId(conv.id);
        setEditingTitle(conv.title);
    };

    const handleSaveRename = async (convId: string) => {
        if (!editingTitle.trim()) return;
        try {
            await window.ipcRenderer.invoke('chat:update-title', convId, editingTitle.trim());
            setEditingConvId(null);
            await loadConversations();
        } catch (err) {
            console.error('Failed to update title:', err);
        }
    };

    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([
            { role: 'system', content: 'You are a helpful coding assistant.' }
        ]);
    };

    const handleConversationContextMenu = (e: React.MouseEvent, conv: any) => {
        e.preventDefault();
        e.stopPropagation();
        setConversationContextMenu({ x: e.clientX, y: e.clientY, conv });
    };

    const handleConversationMenuAction = async (action: string) => {
        if (!conversationContextMenu) return;
        const { conv } = conversationContextMenu;

        try {
            switch (action) {
                case 'fork':
                    await handleForkConversation(conv.id);
                    break;
                case 'rename':
                    setEditingConvId(conv.id);
                    setEditingTitle(conv.title || 'Untitled Conversation');
                    break;
                case 'delete':
                    await handleDeleteConversation({ stopPropagation: () => { } } as React.MouseEvent, conv.id);
                    break;
            }
        } finally {
            setConversationContextMenu(null);
        }
    };

    const handleForkConversation = async (conversationId?: string) => {
        const sourceConversationId = conversationId || activeConversationId;
        if (!sourceConversationId) return;
        try {
            setIsLoading(true);
            const newConvId = await window.ipcRenderer.invoke('chat:fork-conv', sourceConversationId);
            setActiveConversationId(newConvId);
            await loadConversations();
            await refreshActiveMessages(newConvId);
        } catch (e: any) {
            console.error('Failed to fork chat:', e);
            alert('Failed to fork chat: ' + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const isLocalAgentRunningRef = useRef(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    interface QueuedMessage {
        content: string;
        attachedFile?: { name: string; path: string; content: string } | null;
        isPlanMode?: boolean;
        id: number;
    }

    const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
    const messageQueueRef = useRef<QueuedMessage[]>([]);
    messageQueueRef.current = messageQueue;

    // Settings Panel
    const [showSettings, setShowSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [tempGithubToken, setTempGithubToken] = useState('');
    const [credentialStatuses, setCredentialStatuses] = useState<Record<string, { hasKey: boolean; encryptionAvailable: boolean }>>({});

    const fetchCredentialStatuses = async () => {
        try {
            const keys = await window.ipcRenderer.invoke('secure:list-keys');
            const statusMap: Record<string, { hasKey: boolean; encryptionAvailable: boolean }> = {};
            for (const k of keys) {
                statusMap[k.providerId] = k;
            }
            setCredentialStatuses(statusMap);
        } catch (e) {
            console.error('[ChatPanel] Failed to fetch credential statuses:', e);
        }
    };

    useEffect(() => {
        if (showSettings) {
            fetchCredentialStatuses();
        }
    }, [showSettings]);

    // Active Model & Provider selection
    const [activeProvider, setActiveProvider] = useState('openai');
    const [activeModel, setActiveModel] = useState('gpt-4o');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [inlineModelInput, setInlineModelInput] = useState('');
    const [customModels, setCustomModels] = useState<any[]>([]);

    // File attachments
    const [attachedFile, setAttachedFile] = useState<{ name: string; path: string; content: string } | null>(null);

    // Execution Modes: 'fast' | 'think'
    const [executionMode, setExecutionMode] = useState<'fast' | 'think'>('fast');

    // Plus button popover menu states
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [showAgentSubmenu, setShowAgentSubmenu] = useState(false);
    const [showWorkflowSubmenu, setShowWorkflowSubmenu] = useState(false);
    const [isPlanModeActive, setIsPlanModeActive] = useState(false);
    const [dbAgents, setDbAgents] = useState<{ id: number; name: string; system_prompt: string }[]>([]);
    const [activeAgent, setActiveAgent] = useState<AppAgent | null>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<AppFlow | null>(null);

    // Slash Commands (Temporarily prefixed with underscore to satisfy strict checks)
    interface Flow { id: number; name: string; description: string; steps: any; agent_id: number; }
    const [_flows, _setFlows] = useState<Flow[]>([]);

    // Think Planning State
    interface PlanStep {
        id: string;
        title: string;
        subSteps?: PlanStep[];
        status: 'pending' | 'in-progress' | 'done';
        expanded?: boolean;
    }
    const [currentPlan, setCurrentPlan] = useState<PlanStep[] | null>(null);
    const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);

    // Update context when executionContext changes
    useEffect(() => {
        if (executionContext) {
            const { agent, flow } = executionContext;

            if (flow.steps && flow.steps.nodes) {
                setMessages([
                    { role: 'system', content: agent.system_prompt || 'You are a helpful coding assistant.' },
                    { role: 'system', content: `Starting Visual Workflow: ${flow.name}` },
                ]);
                runGraphWorkflow(flow.steps.nodes, flow.steps.edges, agent);
            } else {
                const stepsList = Array.isArray(flow.steps) ? flow.steps : [];
                const flowContext = `Wait! You are now executing a defined flow.\n\nFLOW: ${flow.name}\nDESCRIPTION: ${flow.description}\n\nSTEPS TO EXECUTE:\n${stepsList.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\nPlease execute the steps one by one or as appropriate.`;

                setMessages([
                    { role: 'system', content: agent.system_prompt || 'You are a helpful coding assistant.' },
                    { role: 'system', content: flowContext },
                    { role: 'assistant', content: `activated agent **${agent.name}**. I am ready to run flow: **${flow.name}**.` }
                ]);
            }
        }
    }, [executionContext]);

    const activeConversationIdRef = useRef(activeConversationId);
    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    useEffect(() => {
        const handlePlanModifyStarted = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const instructions = customEvent.detail.instructions;
            const convId = activeConversationIdRef.current;
            
            if (convId) {
                const userContent = `**Plan Modification Request**:\n> ${instructions}`;
                try {
                    await window.ipcRenderer.invoke('chat:add-message', convId, 'user', userContent);
                    
                    // Start live timing counter for background optimization
                    currentActivitiesRef.current = []; // Clear old activities
                    setCurrentlyReadingFiles([]);
                    setIsPlanModifying(true);
                    planStartTimeRef.current = Date.now();
                    setStreamElapsed(0);
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                    }
                    timerRef.current = setInterval(() => {
                        if (planStartTimeRef.current) {
                            setStreamElapsed((Date.now() - planStartTimeRef.current) / 1000);
                        }
                    }, 100);

                    // Append temporary assistant modification loader message to state
                    const assistantContent = `**AI is updating the implementation plan...**\nRunning background optimization. Please wait.`;
                    const tempMessageId = await window.ipcRenderer.invoke('chat:add-message', convId, 'assistant', assistantContent);
                    planModifyAssistantMessageIdRef.current = tempMessageId !== undefined && tempMessageId !== null ? Number(tempMessageId) : null;
                    await refreshActiveMessages(convId, true);
                } catch (err) {
                    console.error('Failed to document plan modification start:', err);
                }
            }
        };

        const handlePlanModifyEnded = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const success = customEvent.detail.success;
            const description = customEvent.detail.description;
            const errorMessage = customEvent.detail.errorMessage || 'The model did not return valid plan JSON.';
            const convId = activeConversationIdRef.current;
            
            // Stop and clear the timing counter
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setIsPlanModifying(false);

            if (convId) {
                try {
                    const finalDuration = planStartTimeRef.current 
                        ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1)
                        : '0.0';

                    const statusContent = success 
                        ? `**Plan Modified Successfully** (Took ${finalDuration}s)\n${description}\n\nRoadmap & Design Specifications updated in [Design Doc (implementation_plan.md)](file:///implementation_plan.md) successfully. Inspect the detailed plan in the tabs above.`
                        : `**Plan Modification Failed** (Took ${finalDuration}s)\n${errorMessage}`;

                    if (planModifyAssistantMessageIdRef.current) {
                        const updated = await window.ipcRenderer.invoke(
                            'chat:update-message',
                            convId,
                            planModifyAssistantMessageIdRef.current,
                            statusContent
                        );
                        if (!updated) {
                            await window.ipcRenderer.invoke('chat:add-message', convId, 'assistant', statusContent);
                        }
                    } else {
                        await window.ipcRenderer.invoke('chat:add-message', convId, 'assistant', statusContent);
                    }

                    planModifyAssistantMessageIdRef.current = null;
                    await refreshActiveMessages(convId, false);
                } catch (err) {
                    console.error('Failed to document plan modification end:', err);
                    planModifyAssistantMessageIdRef.current = null;
                }
            }
        };

        window.addEventListener('plan:modify-started', handlePlanModifyStarted);
        window.addEventListener('plan:modify-ended', handlePlanModifyEnded);

        return () => {
            window.removeEventListener('plan:modify-started', handlePlanModifyStarted);
            window.removeEventListener('plan:modify-ended', handlePlanModifyEnded);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        let currentAgentOutput = '';
        
        const handleAgentChunk = (_event: any, chunk: string) => {
            if (isLocalAgentRunningRef.current) return;
            currentAgentOutput += chunk;
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isAgentExecution) {
                    return [...prev.slice(0, -1), { 
                        role: 'assistant', 
                        content: currentAgentOutput,
                        isAgentExecution: true
                    }];
                } else {
                    return [...prev, { 
                        role: 'assistant', 
                        content: currentAgentOutput,
                        isAgentExecution: true
                    }];
                }
            });
        };

        const handleAgentComplete = async (_event: any, code: number) => {
            if (isLocalAgentRunningRef.current) return;
            const finalOutput = currentAgentOutput;
            currentAgentOutput = '';
            
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isAgentExecution) {
                    return [...prev.slice(0, -1), { 
                        role: 'assistant', 
                        content: finalOutput + `\n\n*(Agent execution finished with code ${code})*`,
                        isAgentExecution: false
                    }];
                }
                return prev;
            });

            if (activeConversationId) {
                try {
                    await window.ipcRenderer.invoke(
                        'chat:add-message', 
                        activeConversationId, 
                        'assistant', 
                        finalOutput + `\n\n*(Agent execution finished with code ${code})*`
                    );
                    await loadConversations();
                } catch (e) {
                    console.error('Failed to save background agent run to DB:', e);
                }
            }
        };

        window.ipcRenderer.on('openclaw:agent-stream', handleAgentChunk);
        window.ipcRenderer.on('openclaw:agent-complete', handleAgentComplete);

        return () => {
            window.ipcRenderer.off('openclaw:agent-stream', handleAgentChunk);
            window.ipcRenderer.off('openclaw:agent-complete', handleAgentComplete);
        };
    }, [activeConversationId]);

    const runGraphWorkflow = async (nodes: any[], edges: any[], _agent: any) => {
        console.assert(Array.isArray(nodes), 'nodes list must be an array');
        console.assert(Array.isArray(edges), 'edges list must be an array');
        const generator = executeWorkflow(nodes, edges, {});
        setIsLoading(true);

        const executeSingleAction = async (action: WorkflowAction): Promise<any> => {
            if (action.type === 'log') {
                setMessages(prev => [...prev, { role: 'system', content: `[Workflow] ${action.message}` }]);
                return 'Log Printed';
            }
            if (action.type === 'tool') {
                setMessages(prev => [...prev, { role: 'system', content: `[Tool] Executing ${action.toolConfig?.name}...` }]);
                await new Promise(r => setTimeout(r, 1000));
                setMessages(prev => [...prev, { role: 'system', content: `[Tool] Output: Success (Simulated)` }]);
                return 'Tool Success';
            }
            if (action.type === 'planner') {
                setMessages(prev => [...prev, { role: 'system', content: `[Planner] Analyzing Goal: "${action.plannerConfig?.goal}"` }]);
                await new Promise(r => setTimeout(r, 1500));
                setMessages(prev => [...prev, { role: 'system', content: `[Planner] Plan Generated.` }]);
                return ['Analyzing Requirements', 'Code Implementation', 'Verification'];
            }
            if (action.type === 'task') {
                setMessages(prev => [...prev, { role: 'system', content: `[Task] ${action.taskConfig?.label}` }]);
                if (action.taskConfig?.assignee) {
                    setMessages(prev => [...prev, { role: 'system', content: `  ↳ Assigned to: ${action.taskConfig?.assignee}` }]);
                }
                await new Promise(r => setTimeout(r, 800));
                return 'Task Done';
            }
            if (action.type === 'openclaw') {
                const message = action.openClawConfig?.message || 'Run Agent';
                const depth = action.openClawConfig?.thinkingDepth || 'medium';
                setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Invoking: "${message}" (Reasoning: ${depth})` }]);
                
                isLocalAgentRunningRef.current = true;
                return new Promise((resolve) => {
                    let agentResultText = '';
                    const handleChunk = (_event: any, chunk: string) => {
                        agentResultText += chunk;
                    };
                    const handleComplete = (_event: any, code: number) => {
                        isLocalAgentRunningRef.current = false;
                        window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
                        window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
                        setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Completed with exit code ${code}.` }]);
                        resolve(agentResultText || 'Execution Completed');
                    };

                    window.ipcRenderer.on('openclaw:agent-stream', handleChunk);
                    window.ipcRenderer.on('openclaw:agent-complete', handleComplete);
                    
                    window.ipcRenderer.invoke('openclaw:run-agent', message, depth).catch(err => {
                        isLocalAgentRunningRef.current = false;
                        window.ipcRenderer.off('openclaw:agent-stream', handleChunk);
                        window.ipcRenderer.off('openclaw:agent-complete', handleComplete);
                        setMessages(prev => [...prev, { role: 'system', content: `[OpenClaw Agent] Spawn Error: ${err.message}` }]);
                        resolve(`Error: ${err.message}`);
                    });
                });
            }
            if (action.type === 'codesearch') {
                const searchType = action.codeSearchConfig?.searchType || 'symbols';
                const query = action.codeSearchConfig?.query || '';
                setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Running ${searchType} search for "${query}"...` }]);
                try {
                    const rootPath = await window.ipcRenderer.invoke('resolve-path', '.');
                    let result: any;
                    if (searchType === 'symbols') {
                        result = await window.ipcRenderer.invoke('code:get-symbols', query);
                    } else if (searchType === 'refs') {
                        result = await window.ipcRenderer.invoke('code:find-references', query, rootPath);
                    } else if (searchType === 'hierarchy') {
                        result = await window.ipcRenderer.invoke('code:get-call-hierarchy', query, rootPath, 'incoming');
                    }
                    const formatted = JSON.stringify(result, null, 2);
                    setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Found details:\n\`\`\`json\n${formatted.slice(0, 1000)}\n\`\`\`` }]);
                    return result;
                } catch (err: any) {
                    setMessages(prev => [...prev, { role: 'system', content: `[Code Search] Error: ${err.message}` }]);
                    return `Error: ${err.message}`;
                }
            }
            if (action.type === 'verify') {
                const ruleId = action.verifyConfig?.ruleId || 0;
                setMessages(prev => [...prev, { role: 'system', content: `[Verification] Running Verification rule ID ${ruleId}...` }]);
                try {
                    const result = await window.ipcRenderer.invoke('verify:run', ruleId);
                    const statusEmoji = result.status === 'passed' ? '✅' : '❌';
                    setMessages(prev => [...prev, { role: 'system', content: `[Verification] Result: ${statusEmoji} ${result.status.toUpperCase()} - ${result.message || ''}` }]);
                    return result;
                } catch (err: any) {
                    setMessages(prev => [...prev, { role: 'system', content: `[Verification] Error: ${err.message}` }]);
                    return `Error: ${err.message}`;
                }
            }
            return 'Action Completed';
        };

        try {
            let result = await generator.next();
            while (!result.done) {
                const action = result.value as WorkflowAction;

                if (action.type === 'log') {
                    setMessages(prev => [...prev, { role: 'system', content: `[Workflow] ${action.message}` }]);
                    result = await generator.next();
                }
                else if (action.type === 'agent') {
                    setMessages(prev => [...prev, { role: 'assistant', content: `[Agent: ${action.agentConfig?.name}] Executing...` }]);
                    setMessages(prev => [...prev, { role: 'system', content: 'Graph execution via Frontend is deprecated. Please migrate graph features.' }]);
                    return;
                }
                else if (action.type === 'parallel') {
                    setMessages(prev => [...prev, { role: 'system', content: `[Parallel] Launching ${action.actions?.length || 0} tasks concurrently...` }]);
                    const results = await Promise.all((action.actions || []).map(act => executeSingleAction(act)));
                    setMessages(prev => [...prev, { role: 'system', content: `[Parallel] All parallel branches completed.` }]);
                    result = await generator.next(results);
                }
                else {
                    const actionResponse = await executeSingleAction(action);
                    result = await generator.next(actionResponse);
                }
            }
            setMessages(prev => [...prev, { role: 'system', content: 'Workflow Completed Successfully.' }]);
        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'system', content: `Workflow Error: ${e.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const [panelWidth, setPanelWidth] = useState(() => {
        const saved = localStorage.getItem('chatPanelWidth');
        return saved ? parseInt(saved, 10) : 400;
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);

    // Load active settings and query model list
    useEffect(() => {
        const loadInitialData = async () => {
            const settings = await window.ipcRenderer.invoke('get-general-settings');
            if (settings) {
                setActiveProvider(settings.activeProvider || 'openai');
                setActiveModel(settings.selectedModel || 'gpt-4o');
            }

            const flowsData = await window.ipcRenderer.invoke('db-get-flows');
            _setFlows(flowsData || []);

            const agentsData = await window.ipcRenderer.invoke('db-get-agents');
            setDbAgents(agentsData || []);

            await loadConversations();
        };
        loadInitialData();
    }, [isOpen, settingsSavedTrigger]);

    const togglePlusMenu = async () => {
        const nextState = !showPlusMenu;
        setShowPlusMenu(nextState);
        if (nextState) {
            setShowAgentSubmenu(false);
            setShowWorkflowSubmenu(false);
            try {
                const agentsData = await window.ipcRenderer.invoke('db-get-agents');
                setDbAgents(agentsData || []);
                const flowsData = await window.ipcRenderer.invoke('db-get-flows');
                _setFlows(flowsData || []);
            } catch (e) {
                console.error('Failed to load agents dynamically', e);
            }
        }
    };

    // Query dynamic model switcher list on provider changes or settings saved
    useEffect(() => {
        const queryModels = async () => {
            // 1. Fetch custom/chosen models from SQLite
            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
            setCustomModels(dbModels || []);
            const chosenNames = dbModels.map((m: any) => m.model_name);
            
            if (chosenNames.length > 0) {
                // Show ONLY chosen models!
                setAvailableModels(chosenNames);
                if (!chosenNames.includes(activeModel) || !activeModel) {
                    setActiveModel(chosenNames[0]);
                }
            } else {
                // Do NOT fallback! Show empty workspace/model list
                setAvailableModels([]);
                setActiveModel('');
            }
        };
        queryModels();
    }, [activeProvider, settingsSavedTrigger]);

    useEffect(() => {
        localStorage.setItem('chatPanelWidth', panelWidth.toString());
    }, [panelWidth]);

    // Resize handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            
            const minChatWidth = 160;
            const currentMinTotalWidth = showHistoryDrawer ? 240 + minChatWidth : minChatWidth;
            if (newWidth < currentMinTotalWidth) {
                // Snap shut!
                resizingRef.current = false;
                onClose();
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                return;
            }
            
            const chatWidth = showHistoryDrawer ? newWidth - 240 : newWidth;
            const maxChatWidth = window.innerWidth - 100 - (showHistoryDrawer ? 240 : 0);
            setPanelWidth(Math.max(200, Math.min(maxChatWidth, chatWidth)));
        };

        const handleMouseUp = () => {
            resizingRef.current = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [showHistoryDrawer, onClose]);

    const startResize = () => {
        resizingRef.current = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, messageQueue]);

    const handleFileUpload = async () => {
        try {
            const filePath = await window.ipcRenderer.invoke('dialog-open-file');
            if (!filePath) return;
            const content = await window.ipcRenderer.invoke('read-file', filePath);
            const name = filePath.split(/[/\\]/).pop() || filePath;
            setAttachedFile({ name, path: filePath, content });
        } catch (e: any) {
            console.error('Failed to attach file', e);
        }
    };

    const handleSend = async (queuedMsg?: QueuedMessage) => {
        if (!activeModel) {
            setMessages(prev => [...prev, { role: 'system', content: '⚠️ No active model selected. Please search and register a model below or enable one in Settings.' }]);
            return;
        }

        if (isLoading && !queuedMsg) {
            setMessageQueue(prev => [...prev, {
                content: input,
                attachedFile: attachedFile ? { ...attachedFile } : null,
                isPlanMode: isPlanModeActive,
                id: Date.now()
            }]);
            setInput('');
            setAttachedFile(null);
            return;
        }

        const sendContent = queuedMsg ? queuedMsg.content : input;
        const sendAttachedFile = queuedMsg ? queuedMsg.attachedFile : attachedFile;
        const sendPlanModeActive = queuedMsg ? !!queuedMsg.isPlanMode : isPlanModeActive;

        if (!sendContent.trim() && !sendAttachedFile) return;

        // Command parser input hooks
        if (sendContent.trim().startsWith('/')) {
            const command = sendContent.trim();
            if (!queuedMsg) {
                setInput('');
            }
            
            if (command.startsWith('/focus ')) {
                const target = command.substring(7).trim();
                const taskId = parseInt(target, 10);
                if (!isNaN(taskId)) {
                    try {
                        await window.ipcRenderer.invoke('task:start', taskId);
                        setMessages(prev => [...prev, 
                            { role: 'user', content: command },
                            { role: 'system', content: `🎯 **Focus set to Task ID ${taskId}**. Status transitioned to **In Progress**.` }
                        ]);
                    } catch (e: any) {
                        setMessages(prev => [...prev, 
                            { role: 'user', content: command },
                            { role: 'system', content: `❌ **Failed to focus task:** ${e.message}` }
                        ]);
                    }
                } else {
                    setMessages(prev => [...prev, 
                        { role: 'user', content: command },
                        { role: 'system', content: `⚠️ **Invalid Task ID.** Usage: \`/focus [task_id]\`` }
                    ]);
                }
                return;
            }
            
            if (command.startsWith('/todo ')) {
                const todoText = command.substring(6).trim();
                if (todoText) {
                    try {
                        const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                        let parentId: number | null = null;
                        const activeTask = taskTree.find((t: any) => t.status === 'in_progress');
                        if (activeTask) {
                            parentId = activeTask.id;
                        }
                        
                        const newTaskId = await window.ipcRenderer.invoke('task:create', todoText, null, parentId);
                        setMessages(prev => [...prev, 
                            { role: 'user', content: command },
                            { role: 'system', content: `📝 **Subtask created successfully:** "${todoText}" (ID: ${newTaskId}${parentId ? `, Parent ID: ${parentId}` : ''})` }
                        ]);
                    } catch (e: any) {
                        setMessages(prev => [...prev, 
                            { role: 'user', content: command },
                            { role: 'system', content: `❌ **Failed to create subtask:** ${e.message}` }
                        ]);
                    }
                } else {
                    setMessages(prev => [...prev, 
                        { role: 'user', content: command },
                        { role: 'system', content: `⚠️ **Usage:** \`/todo [subtask title]\`` }
                    ]);
                }
                return;
            }
            
            if (command.startsWith('/checkpoint')) {
                const checkpointName = command.substring(11).trim() || `checkpoint_${Date.now()}`;
                try {
                    const rootPath = await window.ipcRenderer.invoke('resolve-path', '.');
                    const snapshotId = await window.ipcRenderer.invoke('vc-create-snapshot', checkpointName, rootPath);
                    setMessages(prev => [...prev, 
                        { role: 'user', content: command },
                        { role: 'system', content: `💾 **Checkpoint "${checkpointName}" captured successfully!** (Snapshot ID: ${snapshotId})` }
                    ]);
                } catch (e: any) {
                    setMessages(prev => [...prev, 
                        { role: 'user', content: command },
                        { role: 'system', content: `❌ **Failed to capture checkpoint:** ${e.message}` }
                    ]);
                }
                return;
            }
        }

        let finalContent = sendContent;
        if (sendAttachedFile) {
            finalContent = `[Attached File: ${sendAttachedFile.name}]\n\`\`\`\n${sendAttachedFile.content}\n\`\`\`\n\n${sendContent}`;
            if (!queuedMsg) setAttachedFile(null);
        }

        currentActivitiesRef.current = [];
        const userMsg: Message = { role: 'user', content: finalContent };
        const assistantPlaceholder: Message = { 
            role: 'assistant', 
            content: '', 
            isPlanMode: sendPlanModeActive, 
            isStreaming: true,
            activities: []
        };
        setMessages(prev => [...prev, userMsg, assistantPlaceholder]);

        if (!queuedMsg) setInput('');
        setCurrentlyReadingFiles([]);
        setIsLoading(true);

        planStartTimeRef.current = Date.now();
        setStreamElapsed(0);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
            if (planStartTimeRef.current) {
                setStreamElapsed((Date.now() - planStartTimeRef.current) / 1000);
            }
        }, 100);

        let currentConvId = activeConversationId;

        try {
            if (!currentConvId) {
                currentConvId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const title = finalContent.trim().slice(0, 35) || 'New Chat';
                await window.ipcRenderer.invoke('chat:create-conv', currentConvId, title, activeModel, activeProvider);
                setActiveConversationId(currentConvId);
                await loadConversations();
            }
            await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'user', finalContent);

            let fullResponse = '';

            const handleChunk = (_: any, chunk: string) => {
                if (chunk.startsWith('Error:')) {
                    console.error('AI Stream Error:', chunk);
                    return;
                }

                fullResponse += chunk;
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg.role === 'assistant') {
                        return [...prev.slice(0, -1), { 
                            role: 'assistant', 
                            content: fullResponse,
                            isPlanMode: isPlanModeActive,
                            isStreaming: true,
                            activities: lastMsg.activities || []
                        }];
                    } else {
                        return [...prev, { 
                            role: 'assistant', 
                            content: fullResponse,
                            isPlanMode: isPlanModeActive,
                            isStreaming: true,
                            activities: []
                        }];
                    }
                });
            };

            const handleEnd = async () => {
                setIsLoading(false);
                cleanupActiveListeners();

                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                let responseToSave = fullResponse;
                if (isPlanModeActive) {
                    try {
                        let parsed: any;
                        try {
                            let cleanJson = fullResponse.trim();
                            const firstBrace = cleanJson.indexOf('{');
                            const lastBrace = cleanJson.lastIndexOf('}');
                            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                            }
                            parsed = JSON.parse(cleanJson);
                        } catch (parseErr) {
                            const parsedObjects = cleanAndExtractJSONObjects(fullResponse);
                            if (parsedObjects.length > 0) {
                                parsed = mergeExecutionPlans(parsedObjects);
                            } else {
                                throw parseErr;
                            }
                        }

                        const activeTaskId = getNumericTaskId(currentConvId || '');

                        await window.ipcRenderer.invoke('plan:save', activeTaskId, JSON.stringify(parsed));
                        
                        const finalDuration = planStartTimeRef.current 
                            ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) 
                            : '0.0';
                        
                        const thinkingMeta = JSON.stringify({
                            duration: finalDuration,
                            files: parsed.filesRead || [],
                            stepsCount: parsed.steps?.length || 0,
                            expectedOutcome: parsed.expectedOutcome || '',
                            confidence: parsed.confidence || 1.0,
                            designDoc: parsed.designDoc || '',
                            steps: (parsed.steps || []).map((s: any) => ({
                                order: s.order,
                                action: s.action,
                                target: s.target,
                                rationale: s.rationale,
                                notes: s.notes,
                                agent: s.agent
                            }))
                        });

                        responseToSave = `[ARCHITECTURAL_THINKING_START]${thinkingMeta}[ARCHITECTURAL_THINKING_END]✨ **Implementation Plan Generated Successfully**\n\nA detailed roadmap with ${parsed.steps?.length || 0} steps has been drafted for this task. You can modify the design spec, add workflows, assign agents, and verify the plan before starting execution:\n\n[Click to Open Interactive Plan](plan://${activeTaskId})`;

                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant') {
                                return [...prev.slice(0, -1), { 
                                    role: 'assistant', 
                                    content: responseToSave,
                                    isPlanMode: false,
                                    isStreaming: false,
                                    filesRead: parsed.filesRead || [],
                                    planSteps: parsed.steps || [],
                                    activities: currentActivitiesRef.current
                                }];
                            }
                            return prev;
                        });

                        if (onOpenPlan) {
                            onOpenPlan(activeTaskId, `Task #${activeTaskId}`);
                        }
                    } catch (err) {
                        console.error('Failed to parse and save generated plan:', err);
                    }
                } else {
                    const finalDuration = planStartTimeRef.current 
                        ? ((Date.now() - planStartTimeRef.current) / 1000).toFixed(1) 
                        : '0.0';

                    let thinkingContent = '';
                    const thinkStartIdx = fullResponse.indexOf('<think>');
                    const thinkEndIdx = fullResponse.indexOf('</think>');
                    if (thinkStartIdx !== -1) {
                        if (thinkEndIdx !== -1 && thinkEndIdx > thinkStartIdx) {
                            thinkingContent = fullResponse.substring(thinkStartIdx + 7, thinkEndIdx).trim();
                        } else {
                            thinkingContent = fullResponse.substring(thinkStartIdx + 7).trim();
                        }
                    }

                    const allFiles = extractFiles(fullResponse);
                    const edited = extractEditedFiles(fullResponse);
                    const viewed = allFiles.filter(f => !edited.includes(f));

                    const responseMetadata = {
                        duration: finalDuration,
                        filesRead: viewed,
                        filesEdited: edited,
                        thoughts: thinkingContent || '',
                        activities: currentActivitiesRef.current
                    };

                    responseToSave = `${fullResponse}\n\n[CHAT_METADATA_START]${JSON.stringify(responseMetadata)}[CHAT_METADATA_END]`;

                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            return [...prev.slice(0, -1), { 
                                role: 'assistant', 
                                content: responseToSave,
                                isPlanMode: false,
                                isStreaming: false,
                                filesRead: viewed,
                                planSteps: []
                            }];
                        }
                        return prev;
                    });
                }

                if (currentConvId) {
                    try {
                        await window.ipcRenderer.invoke('chat:add-message', currentConvId, 'assistant', responseToSave);
                        await loadConversations();
                        await refreshActiveMessages(currentConvId);
                    } catch (dbErr) {
                        console.error('Failed to save assistant reply to DB:', dbErr);
                    }
                }

                // Process the next message in the queue
                const nextQueue = messageQueueRef.current;
                if (nextQueue.length > 0) {
                    const nextMsg = nextQueue[0];
                    setMessageQueue(prev => prev.slice(1));
                    setTimeout(() => {
                        handleSend(nextMsg);
                    }, 100);
                }
            };

            cleanupActiveListeners();
            activeChunkListenerRef.current = handleChunk;
            activeEndListenerRef.current = handleEnd;
            window.ipcRenderer.on('ai:chat-chunk', handleChunk);
            window.ipcRenderer.on('ai:chat-end', handleEnd);

            // Fetch active rules from DB
            const activeRules = await window.ipcRenderer.invoke('db:get-rules');
            const enabledRules = (activeRules || []).filter((r: any) => r.is_active === 1);
            let rulesSystemMessage: Message | null = null;
            if (enabledRules.length > 0) {
                const rulesText = enabledRules.map((r: any) => `- ${r.name}: ${r.content}`).join('\n');
                rulesSystemMessage = {
                    role: 'system',
                    content: `[System Instructions / Rules to Follow]\n${rulesText}`
                };
            }

            // Dynamic Persona & Workflow Prompt Injection
            const systemMessages: Message[] = [];
            if (rulesSystemMessage) {
                systemMessages.push(rulesSystemMessage);
            }
            if (activeAgent) {
                systemMessages.push({
                    role: 'system',
                    content: `[Active Agent Persona: ${activeAgent.name}]\nSystem Prompt:\n${activeAgent.system_prompt || 'You are a helpful coding assistant.'}`
                });
            }
            if (activeWorkflow) {
                const stepsText = Array.isArray(activeWorkflow.steps)
                    ? activeWorkflow.steps.map((s: any, idx: number) => `${idx + 1}. ${s}`).join('\n')
                    : typeof activeWorkflow.steps === 'object'
                        ? JSON.stringify(activeWorkflow.steps)
                        : activeWorkflow.steps || '';
                systemMessages.push({
                    role: 'system',
                    content: `[Active Workflow Context: ${activeWorkflow.name}]\nDescription: ${activeWorkflow.description || ''}\nSteps/Structure:\n${stepsText}`
                });
            }

            // Plan execution mode logic mapping
            // Thinking and Plan execution mode logic mapping
            let finalPrompt = userMsg.content;
            if (executionMode === 'think') {
                finalPrompt = `[Thinking Mode Active: Generate step-by-step structure] ${finalPrompt}`;
            }
            if (isPlanModeActive) {
                const agentsList = dbAgents.map(a => a.name).join(', ');
                const workflowsList = _flows.map(f => f.name).join(', ');
                const assignInstructions = (agentsList || workflowsList) 
                    ? `For each step's "agent" field, you may only choose from the following existing agents: [${agentsList || 'None'}] or workflows: [${workflowsList || 'None'}]. If no existing agents or workflows match the step or if none are available, leave the "agent" field empty/blank (or do not include it). Do NOT invent new agent/workflow names.`
                    : `Do NOT assign any agent to step "agent" fields (leave "agent" empty or omit it) as no agents or workflows are currently defined in the system.`;

                finalPrompt = `[Plan Mode Active] You are tasked with generating a structured implementation plan and a detailed design document. You MUST respond ONLY with a single valid JSON object containing the plan steps, designDoc, tradeoffs, and consequences. Do NOT include any markdown code blocks, text, or warnings around the JSON. Keep it raw JSON.
${assignInstructions}
[ZERO-ASSUMPTION POLICY]
Before proposing code modifications:
1. Verify the existence and structure of any referenced code, variables, database tables, or files. Do not guess.
2. Clearly separate confirmed facts from assumptions.
If the developer instructions ask to start from scratch, regenerate, or create a new plan, discard/ignore any previous plans or plan structures shown in the conversation history and start completely fresh.

For the "designDoc" field: You must act as an expert Chief Software Architect. Write a highly thorough, professional, and detailed design document in Markdown format. The document should contain the following structured sections:
1. **Architectural Overview**: A high-level description of the system's design, architectural blueprint, components interaction, and data flow schemas (using clean ASCII diagrams where helpful).
2. **Database & State Analysis**: Detailed schema definitions of new/modified tables, column types, keys, and indexes, as well as migration and backward-compatibility strategies.
3. **IPC & Interface Specifications**: Explicit definitions of new IPC channels, API endpoints, method signatures, and TypeScript interfaces.
4. **Security & Boundary Isolation**: Rationale on local/remote security, access control, data containment, and path traversal guards.
5. **No Placeholders**: Every section must contain complete, detailed content without arbitrary '// TODO' or '/* write implementation here */' tags.

The JSON format must match:
{
  "steps": [
    {
      "order": 1,
      "action": "create",
      "target": "path/to/file",
      "rationale": "Reason for this change",
      "notes": "Additional notes (optional)",
      "agent": "Name of agent or workflow (optional)"
    }
  ],
  "expectedOutcome": "General outcome description",
  "filesRead": [],
  "filesToModify": [],
  "verificationCriteria": ["Verification criteria 1"],
  "designDoc": "# Detailed Design Document\\n\\nDescribe the architectural blueprint, design choices, data flow schemas, and modifications here.",
  "tradeoffs": [
    {
      "task": "Internal evaluation task or choice analyzed (e.g., SQLite vs DPAPI safeStorage vs Keytar)",
      "considerations": "Key pros, cons, complexity, or security trade-offs considered",
      "decision": "Final decision made and why it was selected"
    }
  ],
  "consequences": [
    {
      "failureMode": "Part of the plan or implementation that fails or is incorrect",
      "consequence": "What can/will go wrong (e.g. key exposure, security vulnerability, data loss)",
      "harm": "How this failure harms the user, system, or company (reputational, credential theft, etc.)",
      "mitigation": "How this plan or implementation mitigates or guards against this risk"
    }
  ]
}

For "tradeoffs": You MUST create/simulate internal evaluation tasks (representing distinct architectural/implementation paths considered), think through their pros and cons, and write down these tradeoffs.
For "consequences": You MUST analyze what can or will go wrong if parts of the plan/implementation are incorrect, exposed, security risks, how it hurts the user or the company, etc.

Here is the request: ${finalPrompt}`;
            }
            const llmUserMsg = { ...userMsg, content: finalPrompt };

            // If an active workflow or agent defines a task ID, we assemble context budget intelligently
            let finalSystemMessages = [...systemMessages];
            try {
                // If a root task is available in database, pull active context budget
                const taskTree = await window.ipcRenderer.invoke('task:get-tree');
                const activeTask = taskTree.find((t: any) => t.status === 'in_progress');
                if (activeTask) {
                    const budgetContext = await window.ipcRenderer.invoke('task:assemble-context', activeTask.id, messages, undefined, activeConversationId);
                    if (budgetContext && budgetContext.systemPrompt) {
                        finalSystemMessages = [
                            ...(rulesSystemMessage ? [rulesSystemMessage] : []),
                            { role: 'system', content: budgetContext.systemPrompt }
                        ];
                    }
                }
            } catch (e) {
                console.error('Failed to assemble budget context, falling back:', e);
            }

            window.ipcRenderer.send('ai:chat-start', {
                messages: [
                    ...finalSystemMessages,
                    ...messages.filter(m => m.role !== 'system'),
                    llmUserMsg
                ],
                providerId: activeProvider,
                model: activeModel
            });

        } catch (error) {
            console.error('Error sending message:', error);
            setIsLoading(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            // Process the next message in the queue on error to prevent blocking
            const nextQueue = messageQueueRef.current;
            if (nextQueue.length > 0) {
                const nextMsg = nextQueue[0];
                setMessageQueue(prev => prev.slice(1));
                setTimeout(() => {
                    handleSend(nextMsg);
                }, 100);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="chat-panel-container" style={{ width: showHistoryDrawer ? panelWidth + 240 : panelWidth }}>
            <div
                className="chat-resize-handle"
                onMouseDown={startResize}
            />

            <div className="chat-panel" style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', overflow: 'hidden' }}>
                {/* Conversations History Sidebar */}
                {showHistoryDrawer && (
                    <div className="chat-history-sidebar" style={{
                        width: 240,
                        borderRight: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--bg-secondary)',
                        height: '100%',
                        flexShrink: 0
                    }}>
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            height: 40,
                            boxSizing: 'border-box'
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Chat History</span>
                            <button
                                onClick={handleNewChat}
                                title="New Chat"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    borderRadius: '4px'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span className="codicon codicon-add" style={{ fontSize: 14 }} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {conversations.length === 0 ? (
                                <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11, fontStyle: 'italic' }}>
                                    No past conversations
                                </div>
                            ) : (
                                conversations.map(conv => {
                                    const isEditing = editingConvId === conv.id;
                                    const isActive = activeConversationId === conv.id;
                                    return (
                                        <div
                                            key={conv.id}
                                            onClick={() => !isEditing && handleSelectConversation(conv.id)}
                                            onContextMenu={(e) => !isEditing && handleConversationContextMenu(e, conv)}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                background: isActive ? 'var(--bg-active)' : 'transparent',
                                                cursor: isEditing ? 'default' : 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 2,
                                                position: 'relative',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={e => { if (!isActive && !isEditing) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                            onMouseOut={e => { if (!isActive && !isEditing) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={editingTitle}
                                                        onChange={e => setEditingTitle(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveRename(conv.id);
                                                            else if (e.key === 'Escape') setEditingConvId(null);
                                                        }}
                                                        autoFocus
                                                        style={{
                                                            flex: 1,
                                                            background: 'var(--bg-input)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: 4,
                                                            color: 'var(--text-primary)',
                                                            padding: '2px 6px',
                                                            fontSize: 11,
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => handleSaveRename(conv.id)}
                                                        style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', padding: 2 }}
                                                    >
                                                        <span className="codicon codicon-check" style={{ fontSize: 12 }} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingConvId(null)}
                                                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}
                                                    >
                                                        <span className="codicon codicon-close" style={{ fontSize: 12 }} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{
                                                        fontSize: 12,
                                                        fontWeight: isActive ? 600 : 500,
                                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        flex: 1,
                                                        marginRight: 6
                                                    }}>
                                                        {conv.title || 'Untitled Conversation'}
                                                    </span>
                                                    <div style={{ display: 'flex', gap: 2 }}>
                                                        <button
                                                            onClick={e => handleStartRename(e, conv)}
                                                            title="Rename"
                                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                                            onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                                            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                        >
                                                            <span className="codicon codicon-edit" style={{ fontSize: 10 }} />
                                                        </button>
                                                        <button
                                                            onClick={e => handleDeleteConversation(e, conv.id)}
                                                            title="Delete"
                                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
                                                            onMouseOver={e => e.currentTarget.style.color = '#ff6b6b'}
                                                            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                        >
                                                            <span className="codicon codicon-trash" style={{ fontSize: 10 }} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', opacity: 0.7 }}>
                                                {conv.model} ({conv.provider})
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {conversationContextMenu && (
                    <ContextMenu
                        x={conversationContextMenu.x}
                        y={conversationContextMenu.y}
                        items={[
                            { label: 'Fork Conversation', action: () => handleConversationMenuAction('fork') },
                            { label: 'Rename', action: () => handleConversationMenuAction('rename'), shortcut: 'F2' },
                            { label: 'Delete', action: () => handleConversationMenuAction('delete'), danger: true }
                        ]}
                        onClose={() => setConversationContextMenu(null)}
                    />
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div className="chat-header">
                        <h3><span className="codicon codicon-hubot" style={{ marginRight: 8 }} />AI Assistant</h3>
                        <div className="chat-actions">
                            <button 
                                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)} 
                                title="Chat History"
                                style={{ 
                                    background: showHistoryDrawer ? 'var(--bg-active)' : 'none', 
                                    border: 'none', 
                                    color: showHistoryDrawer ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                                    cursor: 'pointer', 
                                    marginRight: 4, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center' 
                                }}
                            >
                                <span className="codicon codicon-history" />
                            </button>
                            {activeConversationId && (
                                <button 
                                    onClick={() => handleForkConversation()} 
                                    title="Fork Chat (Copy history to new conversation)"
                                    disabled={isLoading}
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: 'var(--text-secondary)', 
                                        cursor: 'pointer', 
                                        marginRight: 8, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        opacity: isLoading ? 0.5 : 1
                                    }}
                                    onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                >
                                    <span className="codicon codicon-repo-forked" />
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    const systemMsg = messages.find(m => m.role === 'system') || { role: 'system', content: 'You are a helpful coding assistant.' };
                                    const lastMsg = messages.length > 1 ? messages[messages.length - 1] : null;
                                    const newMsgs = [systemMsg];
                                    if (lastMsg) {
                                        newMsgs.push({ role: 'system', content: `[Parent Thread Context Summary]:\n${lastMsg.content.slice(0, 1000)}` });
                                    }
                                    setMessages(newMsgs);
                                    setMessages(prev => [...prev, { role: 'system', content: '🥞 **Sub-Thread Forked!** Older conversation history pruned to prevent context drift and slash token usage.' }]);
                                }} 
                                title="Fork Sub-Thread"
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginRight: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <span className="codicon codicon-git-fork-private" />
                            </button>
                            <button onClick={() => setShowSettings(!showSettings)} title="API Keys">
                                <span className="codicon codicon-key" />
                            </button>
                            <button onClick={onClose} title="Close Chat Panel">
                                <span className="codicon codicon-close" />
                            </button>
                        </div>
                    </div>

                {showSettings && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>OpenAI API Key</label>
                                <CredentialBadge status={credentialStatuses['openai']} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="password"
                                    placeholder="sk-..."
                                    value={tempApiKey}
                                    onChange={e => setTempApiKey(e.target.value)}
                                    style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                                />
                                <button
                                    onClick={async () => {
                                        try {
                                            await window.ipcRenderer.invoke('set-api-key', tempApiKey);
                                            setTempApiKey('');
                                            await fetchCredentialStatuses();
                                        } catch (e: any) { alert(e.message); }
                                    }}
                                    style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >Save</button>
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>GitHub Token (PAT)</label>
                                <CredentialBadge status={credentialStatuses['github']} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="password"
                                    placeholder="ghp_..."
                                    value={tempGithubToken}
                                    onChange={e => setTempGithubToken(e.target.value)}
                                    style={{ flex: 1, padding: '6px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 4 }}
                                />
                                <button
                                    onClick={async () => {
                                        try {
                                            await window.ipcRenderer.invoke('set-github-token', tempGithubToken);
                                            setTempGithubToken('');
                                            await fetchCredentialStatuses();
                                        } catch (e: any) { alert(e.message); }
                                    }}
                                    style={{ padding: '6px 12px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Always render Chat Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(() => {
                        const filteredMsgs = messages.filter(m => m.role !== 'system');
                        return filteredMsgs.map((msg, i) => (
                            <ChatMessageCard 
                                key={i}
                                msg={msg}
                                streamElapsed={streamElapsed}
                                currentlyReadingFiles={currentlyReadingFiles}
                                onApplyCode={onApplyCode}
                                onRollback={handleRollbackConversation}
                                activeConversationId={activeConversationId}
                                onOpenPlan={onOpenPlan}
                            />
                        ));
                    })()}
                    {messageQueue.map((qm, qi) => (
                        <div
                            key={`queued-${qi}`}
                            style={{
                                alignSelf: 'flex-end',
                                maxWidth: '85%',
                                opacity: 0.7,
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px dashed rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                animation: 'fadeInUp 0.3s ease-out'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                                <span className="codicon codicon-history" />
                                <span style={{ fontWeight: 500 }}>Queued ({qi + 1}/{messageQueue.length})</span>
                            </div>
                            <div style={{ color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                {qm.content}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Plan Tree UI (Think Planning Mode) */}
                {currentPlan && currentPlan.length > 0 && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>🧠 Execution Plan</span>
                            {isAwaitingApproval && (
                                <button
                                    onClick={async () => {
                                        setIsAwaitingApproval(false);
                                        setMessages(prev => [...prev, { role: 'system', content: '✅ Plan approved! Executing...' }]);
                                        for (const step of currentPlan) {
                                            setMessages(prev => [...prev, { role: 'system', content: `▶ ${step.title}` }]);
                                            await new Promise(r => setTimeout(r, 500));
                                        }
                                        setMessages(prev => [...prev, { role: 'system', content: '🎉 Plan completed!' }]);
                                        setCurrentPlan(null);
                                    }}
                                    style={{ padding: '4px 8px', background: 'var(--accent-primary)', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer' }}
                                >Approve Plan</button>
                            )}
                        </div>
                    </div>
                )}
                    {/* Attached File Badge & Plan Badge */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 16px 8px 16px', alignSelf: 'flex-start' }}>
                    {attachedFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                            <span className="codicon codicon-file" style={{ fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{attachedFile.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4 }}
                                onClick={() => setAttachedFile(null)}
                            />
                        </div>
                    )}
                    {isPlanModeActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(0, 122, 204, 0.1)', border: '1px solid rgba(0, 122, 204, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-checklist" style={{ fontSize: 12, color: 'var(--accent-primary)' }} />
                            <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>Plan Mode Active</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: 'var(--accent-primary)' }}
                                onClick={() => setIsPlanModeActive(false)}
                            />
                        </div>
                    )}
                    {activeAgent && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-hubot" style={{ fontSize: 12, color: '#a855f7' }} />
                            <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Agent: {activeAgent.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#a855f7' }}
                                onClick={() => setActiveAgent(null)}
                            />
                        </div>
                    )}
                    {activeWorkflow && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 4 }}>
                            <span className="codicon codicon-git-merge" style={{ fontSize: 12, color: '#eab308' }} />
                            <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Workflow: {activeWorkflow.name}</span>
                            <span
                                className="codicon codicon-close"
                                style={{ fontSize: 10, cursor: 'pointer', marginLeft: 4, color: '#eab308' }}
                                onClick={() => setActiveWorkflow(null)}
                            />
                        </div>
                    )}
                </div>

                        {/* Premium Unified Chat Box Container */}
                <div className="chat-input-area" style={{ padding: '12px 16px 16px 16px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocusCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.15)';
                    }}
                    onBlurCapture={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
                    }}
                    >
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                    (e.target as HTMLTextAreaElement).style.height = 'auto';
                                }
                            }}
                            placeholder={isLoading ? 'Type a message to queue...' : (isPlanModeActive ? 'Describe the feature to plan...' : 'Ask anything... (type / for flows)')}
                            style={{
                                minHeight: 48,
                                maxHeight: '35vh',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                fontSize: '13px',
                                fontFamily: 'inherit',
                                color: 'var(--text-primary)',
                                overflowY: 'auto',
                                width: '100%',
                                padding: 0,
                                margin: '0 0 10px 0',
                                lineHeight: '1.5'
                            }}
                            onInput={(e) => {
                                const ta = e.currentTarget;
                                ta.style.height = 'auto';
                                ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.35) + 'px';
                            }}
                        />

                        {/* Toolbar Container embedded inside the capsule */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {/* Plus Trigger Button with Popover Dropdown */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <button
                                        onClick={togglePlusMenu}
                                        title="Add content or tools"
                                        disabled={isLoading}
                                        style={{
                                            padding: '4px',
                                            background: showPlusMenu ? 'var(--bg-active)' : 'transparent',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            color: 'var(--text-secondary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 24,
                                            height: 24,
                                            transition: 'var(--transition-smooth)'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = showPlusMenu ? 'var(--bg-active)' : 'transparent'}
                                    >
                                        <span className="codicon codicon-plus" style={{ fontSize: 13 }} />
                                    </button>


                                    {showPlusMenu && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            background: 'var(--bg-glass)',
                                            backdropFilter: 'var(--glass-blur)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)',
                                            zIndex: 1100,
                                            minWidth: 160,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            marginBottom: 8,
                                            padding: 4
                                        }}>
                                            <div
                                                onClick={async () => {
                                                    setShowPlusMenu(false);
                                                    await handleFileUpload();
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: 'var(--font-xs)',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-primary)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className="codicon codicon-file-media" />
                                                Attach File
                                            </div>

                                            {/* Attach Agent Submenu */}
                                            <div style={{ position: 'relative' }}>
                                                <div
                                                    onClick={() => {
                                                        setShowAgentSubmenu(!showAgentSubmenu);
                                                        setShowWorkflowSubmenu(false);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: 'var(--font-xs)',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        borderRadius: 'var(--radius-sm)'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="codicon codicon-hubot" />
                                                    Attach Agent
                                                    <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                                                </div>

                                                {showAgentSubmenu && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '100%',
                                                        bottom: 0,
                                                        background: 'var(--bg-glass)',
                                                        backdropFilter: 'var(--glass-blur)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        zIndex: 1150,
                                                        minWidth: 140,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginLeft: 4,
                                                        padding: 4
                                                    }}>
                                                        {dbAgents.length === 0 ? (
                                                            <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                No custom agents
                                                            </div>
                                                        ) : (
                                                            dbAgents.map(agent => (
                                                                <div
                                                                    key={agent.id}
                                                                    onClick={() => {
                                                                        setActiveAgent(agent);
                                                                        setShowPlusMenu(false);
                                                                        setShowAgentSubmenu(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        fontSize: 'var(--font-xs)',
                                                                        cursor: 'pointer',
                                                                        color: 'var(--text-primary)',
                                                                        borderRadius: 'var(--radius-sm)'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    {agent.name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Attach Workflow Submenu */}
                                            <div style={{ position: 'relative' }}>
                                                <div
                                                    onClick={() => {
                                                        setShowWorkflowSubmenu(!showWorkflowSubmenu);
                                                        setShowAgentSubmenu(false);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: 'var(--font-xs)',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        borderRadius: 'var(--radius-sm)'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <span className="codicon codicon-git-merge" />
                                                    Attach Workflow
                                                    <span className="codicon codicon-chevron-right" style={{ marginLeft: 'auto', fontSize: 10 }} />
                                                </div>

                                                {showWorkflowSubmenu && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: '100%',
                                                        bottom: 0,
                                                        background: 'var(--bg-glass)',
                                                        backdropFilter: 'var(--glass-blur)',
                                                        border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: 'var(--shadow-lg)',
                                                        zIndex: 1150,
                                                        minWidth: 140,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        marginLeft: 4,
                                                        padding: 4
                                                    }}>
                                                        {_flows.length === 0 ? (
                                                            <div style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                No workflows available
                                                            </div>
                                                        ) : (
                                                            _flows.map(flow => (
                                                                <div
                                                                    key={flow.id}
                                                                    onClick={() => {
                                                                        setActiveWorkflow(flow);
                                                                        setShowPlusMenu(false);
                                                                        setShowWorkflowSubmenu(false);
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        fontSize: 'var(--font-xs)',
                                                                        cursor: 'pointer',
                                                                        color: 'var(--text-primary)',
                                                                        borderRadius: 'var(--radius-sm)'
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                                >
                                                                    {flow.name}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                onClick={() => {
                                                    setIsPlanModeActive(!isPlanModeActive);
                                                    setShowPlusMenu(false);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: 'var(--font-xs)',
                                                    cursor: 'pointer',
                                                    color: isPlanModeActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                    fontWeight: isPlanModeActive ? 600 : 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    borderRadius: 'var(--radius-sm)'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className={`codicon ${isPlanModeActive ? 'codicon-check' : 'codicon-checklist'}`} />
                                                Plan Mode {isPlanModeActive ? '(Active)' : ''}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Model Selector Dropdown switcher */}
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-hover)',
                                        transition: 'var(--transition-smooth)',
                                        userSelect: 'none'
                                    }} 
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}>
                                        <span style={{ fontWeight: 600, color: activeModel ? 'var(--text-primary)' : '#f59e0b' }}>
                                            {activeModel ? activeModel.toUpperCase() : 'NO MODEL ACTIVE'}
                                        </span>
                                        <span className="codicon codicon-chevron-down" style={{ fontSize: 10, opacity: 0.8 }} />
                                    </div>
                                    {showModelDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            background: 'var(--bg-glass)',
                                            backdropFilter: 'var(--glass-blur)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)',
                                            zIndex: 1100,
                                            minWidth: 200,
                                            maxHeight: 280,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            marginBottom: 6,
                                            padding: 4
                                        }}>
                                            {/* Search or Add Model Input field */}
                                            <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search or add model..."
                                                    value={inlineModelInput}
                                                    onChange={e => setInlineModelInput(e.target.value)}
                                                    style={{ width: '100%', background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '5px 8px', borderRadius: '4px', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter' && inlineModelInput.trim()) {
                                                            e.preventDefault();
                                                            const name = inlineModelInput.trim();
                                                            const hasTh = name.startsWith('o1') || name.startsWith('o3') || name.includes('r1') || name.includes('reasoner');
                                                            await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, name, hasTh);
                                                            setInlineModelInput('');
                                                            
                                                            const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
                                                            setCustomModels(dbModels || []);
                                                            const chosenNames = dbModels.map((cm: any) => cm.model_name);
                                                            if (chosenNames.length > 0) {
                                                                setAvailableModels(chosenNames);
                                                            }
                                                            setActiveModel(name);
                                                            setShowModelDropdown(false);
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {/* Scrollable models list */}
                                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180 }}>
                                                {availableModels.length === 0 ? (
                                                    <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                                        <span className="codicon codicon-warning" style={{ fontSize: 16, color: '#f59e0b' }} />
                                                        <span>No active models added.</span>
                                                        <span style={{ fontSize: '9px', opacity: 0.8 }}>Use the register input below or settings to add one!</span>
                                                    </div>
                                                ) : (
                                                    availableModels
                                                        .filter(m => m.toLowerCase().includes(inlineModelInput.toLowerCase()))
                                                        .map(m => {
                                                            const customMatch = customModels.find(cm => cm.model_name === m);
                                                            const hasThinking = customMatch ? customMatch.has_thinking === 1 : (m.startsWith('o1-') || m.startsWith('o3-') || m.includes('deepseek-r1') || m.includes('reasoner'));

                                                        return (
                                                            <div
                                                                key={m}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '5px 8px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    background: activeModel === m ? 'var(--bg-active)' : 'transparent',
                                                                    cursor: 'pointer',
                                                                    transition: 'var(--transition-smooth)'
                                                                }}
                                                                onMouseOver={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                                onMouseOut={(e) => { if (activeModel !== m) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span
                                                                    onClick={() => {
                                                                        setActiveModel(m);
                                                                        setShowModelDropdown(false);
                                                                    }}
                                                                    style={{
                                                                        flex: 1,
                                                                        fontSize: 'var(--font-xs)',
                                                                        color: activeModel === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                        textAlign: 'left',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {m}
                                                                </span>

                                                                {/* Brain Icon Toggle for Thinking capability */}
                                                                <button
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        const customMatch = customModels.find(cm => cm.model_name === m);
                                                                        if (customMatch) {
                                                                            await window.ipcRenderer.invoke('ai:toggle-model-thinking', activeProvider, m, !hasThinking);
                                                                        } else {
                                                                            await window.ipcRenderer.invoke('ai:add-custom-model', activeProvider, m, !hasThinking);
                                                                        }
                                                                        const dbModels = await window.ipcRenderer.invoke('ai:get-custom-models', activeProvider);
                                                                        setCustomModels(dbModels || []);
                                                                    }}
                                                                    title={hasThinking ? 'Disable Reasoning/Thinking for Model' : 'Enable Reasoning/Thinking for Model'}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        padding: '2px',
                                                                        outline: 'none',
                                                                        transition: 'var(--transition-smooth)'
                                                                    }}
                                                                >
                                                                    {/* Miniature Sliding Switch for Model Capability */}
                                                                    <div style={{
                                                                        width: 20,
                                                                        height: 11,
                                                                        borderRadius: 5.5,
                                                                        background: hasThinking ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                                                        position: 'relative',
                                                                        transition: 'background 0.2s ease'
                                                                    }}>
                                                                        <div style={{
                                                                            width: 7,
                                                                            height: 7,
                                                                            borderRadius: '50%',
                                                                            background: '#ffffff',
                                                                            position: 'absolute',
                                                                            top: 2,
                                                                            left: hasThinking ? 11 : 2,
                                                                            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                                                        }} />
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        );
                                                    }))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Thinking Mode Toggle Switch */}
                                <div 
                                    onClick={() => setExecutionMode(prev => prev === 'think' ? 'fast' : 'think')}
                                    title="Toggle AI Thinking / Reasoning Mode"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        padding: '4px 6px',
                                        borderRadius: '8px',
                                        transition: 'background 0.2s ease',
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <DollarIcon active={executionMode === 'think'} />
                                    {/* Sleek Switch Toggle */}
                                    <div style={{
                                        width: 26,
                                        height: 14,
                                        borderRadius: 7,
                                        background: executionMode === 'think' ? '#a78bfa' : 'rgba(255,255,255,0.15)',
                                        position: 'relative',
                                        transition: 'background 0.25s ease',
                                        boxShadow: executionMode === 'think' ? '0 0 8px rgba(167, 139, 250, 0.4)' : 'none'
                                    }}>
                                        <div style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            background: '#ffffff',
                                            position: 'absolute',
                                            top: 2,
                                            left: executionMode === 'think' ? 14 : 2,
                                            transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Microphone Icon (Visual indicator for voice features) */}
                                <button
                                    title="Voice Input"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        padding: '4px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'var(--transition-smooth)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                                >
                                    <span className="codicon codicon-mic" style={{ fontSize: 14 }} />
                                </button>

                                {/* Dynamic rounded blue Arrow Send Button or Stop Button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {(isLoading || isPlanModifying) && (
                                        <button
                                            onClick={handleAbort}
                                            style={{
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: 28,
                                                height: 28,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'var(--transition-smooth)',
                                                boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                                            }}
                                            title="Stop Generation"
                                        >
                                            <span className="codicon codicon-debug-stop" style={{ fontSize: 11 }} />
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleSend()}
                                        disabled={(!input.trim() && !attachedFile) || !activeModel}
                                        style={{
                                            background: (input.trim() && activeModel) ? (isLoading ? '#a78bfa' : '#0070f3') : 'var(--bg-hover)',
                                            color: (input.trim() && activeModel) ? 'white' : 'var(--text-secondary)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: 28,
                                            height: 28,
                                            cursor: (input.trim() && activeModel) ? 'pointer' : 'default',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'var(--transition-smooth)',
                                            transform: (input.trim() && activeModel) ? 'scale(1.05)' : 'scale(1)',
                                            boxShadow: (input.trim() && activeModel) ? (isLoading ? '0 0 8px rgba(167, 139, 250, 0.4)' : '0 0 8px rgba(0, 112, 243, 0.4)') : 'none'
                                        }}
                                        title={isLoading ? "Queue Message" : "Send message"}
                                    >
                                        <span className={`codicon ${isLoading ? 'codicon-history' : 'codicon-arrow-up'}`} style={{ fontSize: 13, fontWeight: 'bold' }} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
}
