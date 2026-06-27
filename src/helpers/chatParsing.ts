import { buildPlanDisplayMessage, extractExecutionPlanFromText } from '../utils/jsonParser';
import { getNumericTaskId } from '../utils/taskId';

export interface ActivityTimelineItem {
    type: 'search' | 'analyze' | 'edit' | 'plan' | 'create';
    query?: string;
    resultsCount?: number;
    filePath?: string;
    lineRange?: string;
    duration?: string;
    additions?: number;
    deletions?: number;
    timestamp: number;
}

export interface ArchitecturalThinkingStep {
    order: number;
    action: string;
    target: string;
    rationale: string;
    notes?: string;
    agent?: string;
}

export interface AssistantActivity {
    duration?: string;
    filesRead: string[];
    filesEdited: string[];
    filesCreated?: string[];
    thoughts?: string;
    planSteps?: ArchitecturalThinkingStep[];
    activities?: ActivityTimelineItem[];
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
}

export type PlanActionMessage =
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

export function extractFiles(text: string): string[] {
    if (!text) return [];
    const fileRegex = /([a-zA-Z0-9_\-./]+\.(?:tsx?|jsx?|html|css|json|py|sh|md|yml|yaml|sql|ts))(?:\s*#L?(\d+)(?:-(\d+))?|\s*:L?(\d+)(?:-(\d+))?)?/gi;
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
}

export function extractEditedFiles(text: string): string[] {
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

// eslint-disable-next-line max-lines-per-function, complexity
export function parseAssistantResponse(
    content: string,
    conversationId?: string,
    isPlanMode?: boolean,
    isStreaming?: boolean
): { activity: AssistantActivity | null; cleanContent: string } {
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
                activities: parsed.activities || [],
                inputTokens: parsed.inputTokens || 0,
                outputTokens: parsed.outputTokens || 0,
                cost: parsed.cost || 0
            };
        } catch (e) {
            console.error('Failed to parse chat message metadata:', e);
        }
    } else if (metaStart !== -1 && metaEnd === -1) {
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
                ...activity,
                duration: parsed.duration || activity?.duration,
                filesRead: parsed.files || parsed.filesRead || activity?.filesRead || [],
                filesEdited: parsed.filesEdited || activity?.filesEdited || [],
                thoughts: parsed.expectedOutcome || activity?.thoughts || '',
                planSteps: parsed.steps || []
            };
        } catch (e) {
            console.error('Failed to parse architectural thinking:', e);
        }
    } else if (thinkStart !== -1 && thinkEnd === -1) {
        cleanContent = cleanContent.substring(0, thinkStart);
    }

    // 3. Extract <think> tags
    const thinkTagStart = cleanContent.indexOf('<think>');
    const thinkTagEnd = cleanContent.indexOf('</think>');
    if (thinkTagStart !== -1) {
        let extractedThoughts = '';
        if (thinkTagEnd !== -1 && thinkTagEnd > thinkTagStart) {
            extractedThoughts = cleanContent.substring(thinkTagStart + 7, thinkTagEnd).trim();
            cleanContent = cleanContent.substring(0, thinkTagStart) + cleanContent.substring(thinkTagEnd + 8);
        } else {
            extractedThoughts = cleanContent.substring(thinkTagStart + 7).trim();
            cleanContent = '';
        }
        if (activity) {
            activity.thoughts = (activity.thoughts ? activity.thoughts + '\n' : '') + extractedThoughts;
        } else {
            activity = { filesRead: [], filesEdited: [], thoughts: extractedThoughts };
        }
    }

    // 4. Check for plan JSON
    const taskIdMatch = content.match(/plan:\/\/(\d+)/);
    let taskId = taskIdMatch ? parseInt(taskIdMatch[1], 10) : null;
    if (!taskId && conversationId) {
        taskId = getNumericTaskId(conversationId);
    }
    const alreadyHasPlanLink = /plan:\/\/\d+/i.test(cleanContent);

    const extractedPlan = extractExecutionPlanFromText(cleanContent);
    const parsedPlan = extractedPlan?.plan ?? null;
    const planJsonStartIndex = extractedPlan?.startIndex ?? -1;

    let jsonStartIndex = planJsonStartIndex;
    if (jsonStartIndex === -1) {
        const braceIdx = cleanContent.indexOf('{');
        if (braceIdx !== -1) {
            const remaining = cleanContent.substring(braceIdx);
            const hasPlanKeys = /"(?:designDoc|steps|expectedOutcome|tradeoffs|consequences|classDependencies)"/.test(remaining);
            if (hasPlanKeys || isPlanMode) {
                jsonStartIndex = braceIdx;
            }
        }
    }

    if (parsedPlan) {
        activity = {
            duration: (parsedPlan.duration as string) || activity?.duration,
            filesRead: (parsedPlan.filesRead as string[]) || (parsedPlan.files as string[]) || activity?.filesRead || [],
            filesEdited: (parsedPlan.filesToModify as string[]) || (parsedPlan.filesEdited as string[]) || activity?.filesEdited || [],
            filesCreated: (parsedPlan.filesToCreate as string[]) || activity?.filesCreated || [],
            thoughts: (parsedPlan.expectedOutcome as string) || activity?.thoughts || '',
            planSteps: (parsedPlan.steps as ArchitecturalThinkingStep[]) || activity?.planSteps || []
        };

        const summaryMessage = buildPlanDisplayMessage(taskId, parsedPlan, alreadyHasPlanLink, isPlanMode);
        const textBeforeJson = jsonStartIndex >= 0 ? cleanContent.substring(0, jsonStartIndex).trim() : '';

        let draftMsg = isPlanMode
            ? `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...`
            : `**Planning...**`;
        const expectedOutcome = typeof parsedPlan.expectedOutcome === 'string' ? parsedPlan.expectedOutcome : '';
        if (expectedOutcome && expectedOutcome !== 'Planning...') {
            draftMsg += `\n\n**Expected Outcome:** ${expectedOutcome}`;
        }

        if (isStreaming) {
            cleanContent = textBeforeJson.length > 0 ? `${textBeforeJson}\n\n${draftMsg}` : draftMsg;
        } else {
            cleanContent = textBeforeJson.length > 0 ? `${textBeforeJson}\n\n${summaryMessage}` : summaryMessage;
        }
    } else if (jsonStartIndex !== -1) {
        const textBeforeJson = cleanContent.substring(0, jsonStartIndex).trim();
        if (isStreaming) {
            const draftMsg = isPlanMode
                ? `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...`
                : `**Planning...**`;
            cleanContent = textBeforeJson.length > 0 ? `${textBeforeJson}\n\n${draftMsg}` : draftMsg;
        } else if (activity?.planSteps && activity.planSteps.length > 0) {
            const summaryMessage = buildPlanDisplayMessage(taskId, null, alreadyHasPlanLink, isPlanMode);
            cleanContent = textBeforeJson.length > 0 ? `${textBeforeJson}\n\n${summaryMessage}` : summaryMessage;
        } else {
            cleanContent = textBeforeJson;
        }
    } else if (!activity && isPlanMode) {
        if (isStreaming) {
            cleanContent = `**Roadmap & Design Specifications** are being drafted in [Design Doc (implementation_plan.md)](file:///implementation_plan.md)...`;
        }
    }

    if (!activity || !activity.filesRead || activity.filesRead.length === 0) {
        const allFiles = extractFiles(content);
        const edited = extractEditedFiles(content);
        const viewed = allFiles.filter(f => !edited.includes(f));

        if (viewed.length > 0 || edited.length > 0) {
            if (!activity) {
                activity = { filesRead: viewed, filesEdited: edited, thoughts: '' };
            } else {
                activity.filesRead = viewed;
                activity.filesEdited = edited;
            }
        }
    }

    cleanContent = cleanContent.trim();
    return { activity, cleanContent };
}

export function parsePlanActionMessage(content: string): PlanActionMessage | null {
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
