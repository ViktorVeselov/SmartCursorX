# Execution Flow Diagram

```mermaid
flowchart TB
    subgraph PLANNING["Planning Phase — PlanningService.generatePlan"]
        P1["Task created in DB"] --> P2["ContextAssembler.assembleContext (budget: 9K tokens)"]
        P2 --> P3["Step 1: generateText with tools (read_file / grep_search / list_directory / write_file / edit_file, max 5 tool steps)"]
        P3 --> P4["Step 2: generateObject (ExecutionPlanSchema -> typed JSON)"]
        P4 --> P5["auditPlan (check all relative imports resolve to existing or planned files)"]
        P5 -->|passes| P6["Save plan to DB"]
        P5 -->|fails| P7{"Retry less than 3?"}
        P7 -->|yes| P8["Append auditFeedback to prompt (temperature: 0.1 -> 0.1 -> 0.3)"]
        P8 --> P3
        P7 -->|no| P9["Throw error: plan failed"]
    end

    subgraph EXECUTE["Execution Phase — ExecutionLoopService.executeTask"]
        E1["executeTask called"] --> E2{"Plan in DB?"}
        E2 -->|no| E3["generatePlan"]
        E3 --> E2
        E2 -->|yes| E4["Re-run auditPlan (throw if fails)"]
        E4 --> E5["performInvestigation (AI returns raw text blob)"]
        E5 --> E6["Baseline taxonomy classification (assembleContext + investText -> taxonomyResult)"]
        E6 --> E7["Pre-execution snapshot (capture all filesToModify)"]
        E7 --> E8["Step loop: for each plan.step"]
    end

    subgraph PER_STEP["Per-Step Setup"]
        S1["Create child task in DB (parent_task_id = taskId)"] --> S2["Per-step snapshot (capture only this step's target files)"]
        S2 --> S3["Per-step taxonomy (reuse baseline if available, else classify fresh)"]
        S3 --> S4["Retry loop: attempt 1..maxRetries 3 (temperature: base + attempt-1 * 0.1)"]
    end

    subgraph STEP_BODY["executeSingleStep (with advisory verification)"]
        T1{"Step action"} -->|read/analyze| T2["assembleContext with investText + sibling outputs"]
        T2 --> T3["AI reads target files, returns analysis text"]
        T3 --> T4["Store analysis as task output (type: analysis)"]
        T4 --> T5{"success"}

        T1 -->|modify/create| T6["assembleContext with investText + codePlanning blueprint for this step's target file"]
        T6 --> T7["AI generates JSON AST patches"]
        T7 --> T8["4-fallback parser chain (JSON AST patches, FILE blocks, Markdown code blocks, Raw path + content)"]
        T8 --> T9{"Parsed OK?"}
        T9 -->|no| T5
        T9 -->|yes| T10{"Plan approved? (plan.approved)"}
        T10 -->|yes| T11["Auto-apply patches"]
        T10 -->|no| T12["Send to user for approval via pending-modifications IPC"]
        T12 --> T13{"User accepted?"}
        T13 -->|no| T5
        T13 -->|yes| T11
        T11 --> T14{"autoVerify?"}
        T14 -->|no| T15["Store output, return success"]
        T14 -->|yes| V1["VerificationService.verifyOutput"]
        V1 --> V2["Tier 0: anti-patterns check + scope warnings (advisory)"]
        V2 --> V3["Tier 0.5: Plan Adherence LLM Judge (advisory)"]
        V3 --> V4{"All checks pass?"}
        V4 -->|yes| T15
        V4 -->|no| V5["Feed structured findings to LLM"]
        V5 --> V6{"LLM fixes code or explains decision"}
        V6 -->|fix| V7["Apply surgical fix patches"]
        V7 --> V8["Re-run verification"]
        V8 --> V9{"Fix rounds < 3?"}
        V9 -->|yes| V3
        V9 -->|no| T5
        V6 -->|explain| V10["Log explanation to task output, accept"]
        V10 --> T15

        T1 -->|delete| T16["User approval required"]
        T16 --> T5
        T1 -->|run_command| T17["User approval required (execution not implemented)"]
        T17 --> T5
    end

    subgraph RETRY["Retry Handling"]
        R1{"Attempt succeeded?"} -->|yes| R2["break retry loop (step.completed = true)"]
        R1 -->|no| R3["Rollback per-step snapshot (restore all target files)"]
        R3 --> R4["Next attempt (LLM retries from clean state)"]
    end

    subgraph DLQ["Dead Letter Queue"]
        D1["After retry loop exhausted (stepSuccess is false)"] --> D2{"Fatal step? (modify/create/delete/run_command)"}
        D2 -->|no| D3["Log warning, continue to next step"]
        D2 -->|yes| D4["handleStepDlq (send execution:dlq-notify IPC to renderer with failure details)"]
        D4 --> D5["Wait for user guidance"]
        D5 -->|user provides text| D6["Full task restart (recursive executeTask userGuidance)"]
        D5 -->|user cancels| D7["Task status: failed"]
    end

    subgraph COMPILATION["Post-Execution Compilation Check"]
        C1["All steps passed"] --> C2["CompilationCheckerService.run (detect languages, run all checks in parallel)"]
        C2 --> C3{"All pass?"}
        C3 -->|yes| C4["LearningService.captureLearning (store metrics + index into RAG)"]
        C4 --> C5["Task status: completed"]
        C3 -->|no| C6["Feed compiler errors to LLM for surgical fix"]
        C6 --> C7["Apply fix, re-run compilation check"]
        C7 --> C8{"Compiles now?"}
        C8 -->|yes| C9["Re-verify plan adherence (tradeoffs, consequences, design intent)"]
        C9 --> C10{"Plan still valid?"}
        C10 -->|yes| C4
        C10 -->|no| C11["Escalate to user: fix violated design intent"]
        C8 -->|no, repairs < 3| C6
        C8 -->|no, repairs >= 3| C12["Escalate to user: unresolved compilation errors"]
    end

    S4 --> T1
    T5 --> R1
    R4 --> S1
    R4 --> S4
    D3 --> C1
    D7 --> C5
    T15 --> C1
    D6 --> E1
```

## Verified Architecture Facts

### Planning Phase
| Fact | Source |
|---|---|
| 2-step process: tools exploration → structured JSON | `PlanningService.ts:89-130` |
| Max 5 tool steps | `stepCountIs(5)` at line 153 |
| Temperature escalation: 0.1, 0.1, 0.3 across 3 retries | `attempt === 3 ? 0.3 : 0.1` at line 152 |
| auditPlan validates relative imports only (not absolute/package) | `importPath.startsWith('.')` at line 460 |

### Execution Phase
| Fact | Source |
|---|---|
| Investigation produces raw text, never parsed | `performInvestigation()` returns string, lines 840-842 |
| investText now passed to assembleContext for all steps | `ExecutionLoopService.ts:442, 528` |
| codePlanning blueprint injected per-step for modify/create | `ExecutionLoopService.ts:596-616` |
| 4-fallback parser chain | Lines 584-636 |

### Verification (Advisory)
| Fact | Source |
|---|---|
| Anti-patterns and plan adherence issues are **advisory** — fed back to LLM for fix/explanation, not hard-blocking | `VerificationService.ts:64, 80-84, 92-97` (modified) |
| LLM can explain why a deviation is acceptable and continue | `ExecutionLoopService.ts` (new fix-round logic) |
| tsc removed from per-step verification — moved to post-execution CompilationCheckerService | `DiffVerificationService.ts` (modified) |

### Retry Logic
| Fact | Source |
|---|---|
| Any failed attempt → rollback per-step snapshot → retry (patch-forward removed) | `ExecutionLoopService.ts:251-253` (modified) |
| Fix rounds (max 3) run within the same attempt before rollback | `ExecutionLoopService.ts` (new) |
| maxRetries = 3 preserved for all paths | `ExecutionConfig.maxRetries` default 3 |
| Non-fatal read/analyze failures continue execution | Lines 297-301 |

### DLQ
| Fact | Source |
|---|---|
| User guidance triggers full recursive task restart | `handleStepDlq` lines 762-800 |
| User cancel marks task as failed | Line 790 |

### Post-Execution Compilation Check
| Fact | Source |
|---|---|
| CompilationCheckerService detects project languages (tsconfig.json, Cargo.toml, go.mod, etc.) and runs all checks in parallel | New file |
| Repair loop: max 3 surgical fixes from compiler error, each re-verified | `execution.ts` (modified) |
| After compilation passes, re-verify plan adherence via LLM judge | `VerificationService.runPlanAdherenceCheck()` |
| LearningService runs only after compilation check + plan re-verify pass | `ExecutionLoopService.ts` (modified) |
| Pre-execution snapshot captures ALL filesToModify | Line 161 |
| Per-step snapshot captures only current step's target files | Line 197 |
