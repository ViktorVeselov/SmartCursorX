export function buildPlanModePrompt(
    userPrompt: string,
    executionMode: string,
    dbAgents: { name: string }[],
    flows: { name: string }[],
    workspacePath?: string,
    platform?: string
): string {
    let finalPrompt = userPrompt;
    if (executionMode === 'think') {
        finalPrompt = `[Thinking Mode Active: Generate step-by-step structure] ${finalPrompt}`;
    }

    const agentsList = dbAgents.map(a => a.name).join(', ');
    const workflowsList = flows.map(f => f.name).join(', ');
    const assignInstructions = (agentsList || workflowsList)
        ? `For each step's "agent" field, please assign the most appropriate agent or workflow from: agents: [${agentsList || 'None'}], workflows: [${workflowsList || 'None'}]. For example, if a step involves modifying or creating code, you should assign "Code Changes" (or another relevant workflow/agent). If no existing agents or workflows are appropriate for the step, leave the "agent" field empty or omit it. Do NOT invent new agent/workflow names.`
        : `Do NOT assign any agent to step "agent" fields (leave "agent" empty or omit it) as no agents or workflows are currently defined in the system.`;

    const osHint = platform
        ? `\n[ENVIRONMENT] You are running on ${platform}. Your workspace root is "${workspacePath || 'unknown'}". All file paths in targets MUST be relative to this workspace root. Do NOT use absolute paths like /tmp/ or C:\\. Do NOT use shell commands — use "read" or "analyze" steps to examine files instead.`
        : '';

    finalPrompt = `[Plan Mode Active] You are tasked with generating a structured implementation plan, detailed roadmap, and architectural analysis.
${assignInstructions}
${osHint}
[ZERO-ASSUMPTION POLICY]
Before proposing code modifications:
1. Verify the existence and structure of any referenced code, variables, database tables, or files. Do not guess.
2. Clearly separate confirmed facts from assumptions.
If the developer instructions ask to start from scratch, regenerate, or create a new plan, discard/ignore any previous plans or plan structures shown in the conversation history and start completely fresh.

You MUST generate non-empty, detailed values for all the following fields:

1. **"steps"**: An array of detailed roadmap steps (at least 3-5 steps) to execute the task. Each step must use the following keys:
   - "order": Step number (integer starting at 1).
   - "action": The action to perform (must be one of: "read", "analyze", "modify", "create", "delete"). "run_command" is NOT available — use "read" or "analyze" to inspect files instead.
   - "target": The file path relative to the workspace root. DO NOT leave this empty! Do NOT use absolute paths or shell commands.
   - "rationale": A detailed explanation of what this step does and why it is necessary. DO NOT use generic filler text like "Review and analyze".
   - "notes": Any specific implementation notes or constraints (optional).
   - "agent": The assigned agent or workflow name (based on the instructions above).
   - "notes": Any specific implementation notes or constraints (optional).
   - "agent": The assigned agent or workflow name (based on the instructions above).

2. **"expectedOutcome"**: A detailed description of the final expected state of the workspace after implementing this plan.

3. **"filesRead"**: An array of all file paths that will be read or analyzed during the plan.

4. **"filesToModify"**: An array of all file paths of EXISTING files that will be modified or deleted during the plan.

5. **"filesToCreate"**: An array of all file paths that will be CREATED as new files during the plan.

6. **"verificationCriteria"**: An array of concrete testing steps or validation commands to run to verify the correctness of the changes.

7. **"confidence"**: A confidence score from 0.0 to 1.0 (e.g., 0.95) representing the plan's feasibility and detail.

8. **"designDoc"**: Act as an expert Chief Software Architect. Write a highly thorough, professional, and detailed design document in Markdown format. Each section below MUST contain multiple paragraphs of substantive, well-reasoned content — never just a single sentence or bullet point. The document must contain the following structured sections:
   - **Architectural Overview**: A high-level description of the system's design, architectural blueprint, components interaction, and data flow schemas (using clean ASCII diagrams where helpful). Include at least 3-5 paragraphs of analysis.
   - **Database & State Analysis**: Detailed schema definitions of new/modified tables, column types, keys, and indexes, as well as migration and backward-compatibility strategies.
   - **IPC & Interface Specifications**: Explicit definitions of new IPC channels, API endpoints, method signatures, and TypeScript interfaces.
   - **Security & Boundary Isolation**: Rationale on local/remote security, access control, data containment, and path traversal guards.
   - **Testing Strategy**: How each component and integration point will be tested, including unit, integration, and end-to-end approaches.
   - **No Placeholders**: Every section must contain complete, detailed content without arbitrary '// TODO' or '/* write implementation here */' tags.

9. **"codePlanning"**: A detailed draft or blueprint of the code changes you intend to make for each file to modify. For each file, provide the code within a standard markdown code block. Every code block MUST have a file header comment specifying the target file (e.g. "// File: src/main.ts") so the system can verify all relative imports. If no code modifications are needed for this task, return an empty string or a simple comment (e.g., "// No code changes planned.").

10. **"tradeoffs"**: An array of tradeoffs & design options (at least 3 distinct architectural options). Each tradeoff must use the following keys:
   - "task": The implementation decision or design option analyzed (e.g., "safeStorage vs standard config", "separate IPC handler vs monolithic").
   - "considerations": Compare alternatives: pros, cons, complexity, security, performance.
   - "decision": The final decision made and its concrete justification.

11. **"consequences"**: An array of risk/failure mode analyses (at least 3 entries). Each entry must use the following keys:
    - "failureMode": The specific code or system-level failure mode (e.g., "SafeStorage unavailable on headless systems").
    - "consequence": Direct runtime impact (e.g., "App crashes on start").
    - "harm": The specific harm to the end user and organization (reputational, credential leak, etc.).
    - "mitigation": The concrete code guard or mitigation in the plan to prevent/handle this.

Here is the request: ${finalPrompt}`;

    return finalPrompt;
}
