import { Buffer } from 'node:buffer';
import { CostEstimatorService } from '../services/CostEstimatorService';
import { checkArgs } from '../../src/helpers/invariant';

export function addMemory(db: any, type: string, content: string) {
    checkArgs(typeof type === 'string' && type.length > 0, 'Memory type must be a valid non-empty string');
    checkArgs(typeof content === 'string' && content.length > 0, 'Memory content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare('INSERT INTO memories (type, content) VALUES (?, ?)');
    stmt.run(type, content);
}

export function getMemories(db: any, type?: string) {
    if (!db) return [];
    const query = type
        ? 'SELECT * FROM memories WHERE type = ? ORDER BY updated_at DESC'
        : 'SELECT * FROM memories ORDER BY updated_at DESC';

    const stmt = db.prepare(query);
    return type ? stmt.all(type) : stmt.all();
}

export function searchMemories(db: any, query: string, limit: number = 5) {
    if (!db) return [];
    const terms = query.split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) {
        return db.prepare('SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?').all(limit);
    }

    const conditions = terms.map(() => 'content LIKE ? OR type LIKE ?').join(' OR ');
    const params: any[] = [];
    for (const t of terms) {
        params.push(`%${t}%`, `%${t}%`);
    }
    params.push(limit);

    const stmt = db.prepare(`
        SELECT * FROM memories 
        WHERE ${conditions}
        ORDER BY updated_at DESC
        LIMIT ?
    `);
    return stmt.all(...params);
}

export function deleteMemory(db: any, id: number) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
}

export function createSnapshot(db: any, name: string) {
    checkArgs(typeof name === 'string' && name.length > 0, 'Snapshot name must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare('INSERT INTO vc_snapshots (name) VALUES (?)');
    const info = stmt.run(name);
    return info.lastInsertRowid;
}

export function addBlob(db: any, hash: string, content: string) {
    checkArgs(typeof hash === 'string' && hash.length > 0, 'Blob hash must be a valid non-empty string');
    checkArgs(typeof content === 'string' && content.length > 0, 'Blob content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare('INSERT OR IGNORE INTO vc_blobs (hash, content) VALUES (?, ?)');
    stmt.run(hash, content);
}

export function addSnapshotFile(db: any, snapshotId: number | bigint, filePath: string, blobHash: string) {
    checkArgs(snapshotId !== undefined, 'Snapshot ID is required');
    checkArgs(typeof filePath === 'string' && filePath.length > 0, 'File path must be a valid non-empty string');
    checkArgs(typeof blobHash === 'string' && blobHash.length > 0, 'Blob hash must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare('INSERT INTO vc_snapshot_files (snapshot_id, file_path, blob_hash) VALUES (?, ?, ?)');
    stmt.run(snapshotId, filePath, blobHash);
}

export function getSnapshots(db: any) {
    if (!db) return [];
    return db.prepare('SELECT * FROM vc_snapshots ORDER BY created_at DESC').all();
}

export function getSnapshot(db: any, id: number) {
    if (!db) return null;
    return db.prepare('SELECT * FROM vc_snapshots WHERE id = ?').get(id);
}

export function getSnapshotFiles(db: any, snapshotId: number) {
    if (!db) return [];
    return db.prepare(`
        SELECT f.file_path, b.content 
        FROM vc_snapshot_files f
        JOIN vc_blobs b ON f.blob_hash = b.hash
        WHERE f.snapshot_id = ?
    `).all(snapshotId);
}

export function createTask(db: any, title: string, description: string | null, parentTaskId?: number | null, assignedAgentId?: number | null, createdBy: string = 'user', contextBudget: number = 3000, priority: number = 0) {
    checkArgs(typeof title === 'string' && title.length > 0, 'Task title must be a valid non-empty string');
    checkArgs(typeof createdBy === 'string', 'createdBy must be a string');
    checkArgs(typeof contextBudget === 'number' && contextBudget > 0, 'contextBudget must be a positive number');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO tasks (title, description, parent_task_id, assigned_agent_id, created_by, context_budget, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(title, description, parentTaskId || null, assignedAgentId || null, createdBy, contextBudget, priority);
    return info.lastInsertRowid;
}

export function updateTaskStatus(db: any, id: number, status: string) {
    checkArgs(typeof id === 'number', 'Task ID must be a number');
    checkArgs(['pending', 'in_progress', 'completed', 'failed', 'blocked'].includes(status), 'Invalid task status');
    if (!db) throw new Error('DB not initialized');

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.prepare(`
        UPDATE tasks 
        SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `).run(status, completedAt, id);
}

export function getTask(db: any, id: number) {
    checkArgs(typeof id === 'number', 'Task ID must be a number');
    if (!db) return null;
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function getTaskTree(db: any) {
    if (!db) return [];
    return db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
}

export function getSubtasks(db: any, parentTaskId: number) {
    checkArgs(typeof parentTaskId === 'number', 'Parent Task ID must be a number');
    if (!db) return [];
    return db.prepare('SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC').all(parentTaskId);
}

export function addTaskOutput(db: any, taskId: number, content: string, agentId?: number | null, outputType: string = 'text', tokenCount: number = 0, modelUsed?: string | null, providerUsed?: string | null) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof content === 'string' && content.length > 0, 'Content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO task_outputs (task_id, agent_id, output_type, content, token_count, model_used, provider_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(taskId, agentId || null, outputType, content, tokenCount, modelUsed || null, providerUsed || null);
    return info.lastInsertRowid;
}

export function updateTaskOutputVerification(db: any, id: number, status: string) {
    checkArgs(typeof id === 'number', 'Output ID must be a number');
    checkArgs(typeof status === 'string', 'Verification status must be a string');
    if (!db) throw new Error('DB not initialized');

    db.prepare('UPDATE task_outputs SET verification_status = ? WHERE id = ?').run(status, id);
}

export function getTaskOutputs(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) return [];
    return db.prepare('SELECT * FROM task_outputs WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
}

export function getTaskOutput(db: any, id: number) {
    checkArgs(typeof id === 'number', 'Output ID must be a number');
    if (!db) return null;
    return db.prepare('SELECT * FROM task_outputs WHERE id = ?').get(id);
}

export function getTaskPlan(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) return null;
    const plan = db.prepare('SELECT * FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId);
    return plan;
}

export function updateTaskPlanJson(db: any, taskId: number, planJson: string, status: string = 'draft', confidence?: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof planJson === 'string', 'Plan JSON must be a string');
    if (!db) throw new Error('DB not initialized');

    const taskRow = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!taskRow) {
        db.prepare("INSERT INTO tasks (id, title, description, status) VALUES (?, 'Chat Plan Task', 'Auto-created task from chat planning session', 'in_progress')")
            .run(taskId);
    }

    const existing = db.prepare('SELECT id FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId);
    if (existing) {
        db.prepare('UPDATE task_plans SET plan_json = ?, status = ?, confidence = ? WHERE id = ?')
            .run(planJson, status, confidence !== undefined ? confidence : null, existing.id);
    } else {
        db.prepare('INSERT INTO task_plans (task_id, plan_json, status, confidence) VALUES (?, ?, ?, ?)')
            .run(taskId, planJson, status, confidence !== undefined ? confidence : 1.0);
    }
    return true;
}

export function findPlanByTitle(db: any, taskId: number, title: string) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof title === 'string', 'Title must be a string');
    if (!db) return null;
    const rows = db.prepare('SELECT * FROM task_plans WHERE task_id = ?').all(taskId);
    for (const row of rows) {
        try {
            const json = JSON.parse(row.plan_json);
            if (json.title && json.title === title) {
                return row;
            }
        } catch (e) {
        }
    }
    return null;
}

export function rollbackTaskPlan(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) throw new Error('DB not initialized');
    const latest = db.prepare('SELECT id FROM task_plans WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId);
    if (latest && latest.id) {
        db.prepare('DELETE FROM task_plans WHERE id = ?').run(latest.id);
    }
}

export function addTaskPlan(db: any, taskId: number, planJson: string, confidence: number, status: string = 'draft') {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof planJson === 'string', 'Plan JSON must be a string');
    checkArgs(typeof confidence === 'number', 'Confidence must be a number');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO task_plans (task_id, plan_json, status, confidence)
        VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(taskId, planJson, status, confidence);
    return info.lastInsertRowid;
}

export function updateTaskPlanStatus(db: any, planId: number, status: string) {
    checkArgs(typeof planId === 'number', 'Plan ID must be a number');
    checkArgs(typeof status === 'string', 'Status must be a string');
    if (!db) throw new Error('DB not initialized');

    db.prepare('UPDATE task_plans SET status = ? WHERE id = ?').run(status, planId);
}

export function addTaskDoc(db: any, taskId: number, title: string, content: string, docType: string = 'completion', generatedBy: string = 'auto') {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof title === 'string' && title.length > 0, 'Title must be a valid non-empty string');
    checkArgs(typeof content === 'string' && content.length > 0, 'Doc content must be a valid non-empty string');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO task_docs (task_id, title, content, doc_type, generated_by)
        VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(taskId, title, content, docType, generatedBy);
    return info.lastInsertRowid;
}

export function getTaskDocs(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) return [];
    return db.prepare('SELECT * FROM task_docs WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
}

export function addExecutionAttempt(db: any, taskId: number, attemptNumber: number, modelUsed: string | null, providerUsed: string | null, planId: number | null, outputId: number | null, verificationStatus: string, failureReason: string | null) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    checkArgs(typeof attemptNumber === 'number', 'Attempt number must be a number');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO execution_attempts (task_id, attempt_number, model_used, provider_used, plan_id, output_id, verification_status, failure_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(taskId, attemptNumber, modelUsed, providerUsed, planId, outputId, verificationStatus, failureReason);
    return info.lastInsertRowid;
}

export function getExecutionAttempts(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) return [];
    return db.prepare('SELECT * FROM execution_attempts WHERE task_id = ? ORDER BY attempt_number ASC').all(taskId);
}

export function getTaskExecutionDetails(db: any, taskId: number) {
    checkArgs(typeof taskId === 'number', 'Task ID must be a number');
    if (!db) return [];

    const attempts = db.prepare(`
        SELECT ea.*, o.content as output_content
        FROM execution_attempts ea
        LEFT JOIN task_outputs o ON ea.output_id = o.id
        WHERE ea.task_id = ?
        ORDER BY ea.attempt_number ASC
    `).all(taskId);

    return attempts.map((a: any) => {
        let verificationResults = [];
        if (a.output_id) {
            verificationResults = db.prepare(`
                SELECT vr.*, r.name as rule_name, r.rule_type
                FROM verification_results vr
                JOIN verification_rules r ON vr.rule_id = r.id
                WHERE vr.task_output_id = ?
            `).all(a.output_id);
        }
        return {
            ...a,
            verification_results: verificationResults
        };
    });
}

export function addVerificationRule(db: any, name: string, description: string | null, ruleType: string, triggerOn: string, config: object, appliesTo: string = '*') {
    checkArgs(typeof name === 'string' && name.length > 0, 'Rule name is required');
    checkArgs(['pattern', 'llm_judge', 'human'].includes(ruleType), 'Invalid rule type');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO verification_rules (name, description, rule_type, trigger_on, config, applies_to)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, description, ruleType, triggerOn, JSON.stringify(config), appliesTo);
    return info.lastInsertRowid;
}

export function getVerificationRules(db: any) {
    if (!db) return [];
    const rules = db.prepare('SELECT * FROM verification_rules').all();
    return rules.map((r: any) => ({ ...r, config: JSON.parse(r.config) }));
}

export function addVerificationResult(db: any, taskOutputId: number, ruleId: number, result: string, score: number | null, details: string | null, verifiedBy: string) {
    checkArgs(typeof taskOutputId === 'number', 'Task Output ID must be a number');
    checkArgs(typeof ruleId === 'number', 'Rule ID must be a number');
    checkArgs(['passed', 'failed', 'pending_review'].includes(result), 'Invalid verification result');
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
        INSERT INTO verification_results (task_output_id, rule_id, result, score, details, verified_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(taskOutputId, ruleId, result, score, details, verifiedBy);
    return info.lastInsertRowid;
}

export function getVerificationResults(db: any, taskOutputId: number) {
    checkArgs(typeof taskOutputId === 'number', 'Task Output ID must be a number');
    if (!db) return [];
    return db.prepare('SELECT * FROM verification_results WHERE task_output_id = ?').all(taskOutputId);
}

export function addKnowledgeChunk(db: any, sourceType: string, sourceId: string | null, content: string, metadata: object, tokenCount: number = 0, embedding?: number[] | Float32Array) {
    checkArgs(typeof sourceType === 'string' && sourceType.length > 0, 'Source type is required');
    checkArgs(typeof content === 'string' && content.length > 0, 'Chunk content is required');
    if (!db) throw new Error('DB not initialized');

    const runTx = db.transaction((embData?: Float32Array) => {
        const chunkStmt = db.prepare(`
            INSERT INTO knowledge_chunks (source_type, source_id, content, metadata, token_count)
            VALUES (?, ?, ?, ?, ?)
        `);
        const chunkInfo = chunkStmt.run(sourceType, sourceId, content, JSON.stringify(metadata), tokenCount);
        const chunkId = chunkInfo.lastInsertRowid;

        if (embData) {
            const vecStmt = db.prepare(`
                INSERT INTO vec_knowledge (chunk_id, embedding)
                VALUES (?, ?)
            `);
            vecStmt.run(BigInt(chunkId), Buffer.from(embData.buffer, embData.byteOffset, embData.byteLength));
        }
        return chunkId;
    });

    let floatArray: Float32Array | undefined;
    const dim = getEmbeddingDbDim(db);
    if (embedding) {
        floatArray = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
        checkArgs(floatArray.length === dim, `Vector embedding must have exactly ${dim} dimensions (got ${floatArray.length})`);
    }

    return runTx(floatArray);
}

function getEmbeddingDbDim(db: any): number {
    const { getStoredEmbeddingDim } = require('./schema');
    return getStoredEmbeddingDim(db) || 1536;
}

export function searchKnowledge(db: any, queryEmbedding: number[] | Float32Array, limit: number = 10) {
    checkArgs(limit > 0, 'Limit must be positive');
    if (!db) return [];

    const dim = getEmbeddingDbDim(db);
    const floatArray = queryEmbedding instanceof Float32Array ? queryEmbedding : new Float32Array(queryEmbedding);
    checkArgs(floatArray.length === dim, `Query vector must have exactly ${dim} dimensions (got ${floatArray.length})`);

    const stmt = db.prepare(`
        SELECT 
            k.id,
            k.source_type,
            k.source_id,
            k.content,
            k.metadata,
            k.token_count,
            v.distance
        FROM vec_knowledge v
        JOIN knowledge_chunks k ON v.chunk_id = k.id
        WHERE v.embedding MATCH ? AND v.k = ?
        ORDER BY v.distance ASC
    `);

    const results = stmt.all(Buffer.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength), limit);
    return results.map((r: any) => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata) : {}
    }));
}

export function addModelPerformance(db: any, model: string, provider: string, taskType: string | null, success: number, attemptNumber: number, tokenCount: number, latencyMs: number, inputTokens: number = 0, outputTokens: number = 0) {
    checkArgs(typeof model === 'string' && model.length > 0, 'Model must be a non-empty string');
    checkArgs(typeof provider === 'string' && provider.length > 0, 'Provider must be a non-empty string');
    if (!db) throw new Error('DB not initialized');

    const inputVal = inputTokens || Math.round(tokenCount * 0.8);
    const outputVal = outputTokens || (tokenCount - inputVal);

    const stmt = db.prepare(`
        INSERT INTO model_performance (model, provider, task_type, success, attempt_number, token_count, latency_ms, input_tokens, output_tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(model, provider, taskType, success, attemptNumber, tokenCount, latencyMs, inputVal, outputVal);
    return info.lastInsertRowid;
}

export function getModelPerformanceSummary(db: any) {
    if (!db) return [];
    return db.prepare(`
        SELECT model, provider, COUNT(*) as total_runs, SUM(success) as successful_runs, AVG(latency_ms) as avg_latency
        FROM model_performance
        GROUP BY model, provider
    `).all();
}

export function getUsageStats(db: any) {
    if (!db) return { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, breakdowns: [] };

    const rows = db.prepare(`
        SELECT model, provider, COUNT(*) as total_runs, SUM(token_count) as total_tokens, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output
        FROM model_performance
        GROUP BY model, provider
    `).all();

    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    const breakdowns = rows.map((row: any) => {
        const tokens = row.total_tokens || 0;
        const inputTokens = row.total_input || 0;
        const outputTokens = row.total_output || 0;

        totalTokens += tokens;
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        const cost = CostEstimatorService.estimateCost(row.model, inputTokens, outputTokens, row.provider);
        totalCost += cost;

        return {
            model: row.model,
            provider: row.provider,
            runs: row.total_runs,
            tokens,
            inputTokens,
            outputTokens,
            cost: Number(cost.toFixed(6))
        };
    });

    return {
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalCost: Number(totalCost.toFixed(4)),
        breakdowns
    };
}

export function getModelPerformanceStats(db: any, filterProvider?: string, filterModel?: string, filterTaskType?: string) {
    if (!db) return [];

    let query = `
        SELECT
            model, provider, task_type,
            COUNT(*) as total_runs,
            SUM(success) as successful_runs,
            ROUND(CAST(SUM(success) AS REAL) / MAX(COUNT(*), 1), 4) as success_rate,
            AVG(latency_ms) as avg_latency_ms,
            AVG(input_tokens) as avg_input_tokens,
            AVG(output_tokens) as avg_output_tokens,
            AVG(token_count) as avg_token_count
        FROM model_performance
        WHERE 1=1
    `;
    const params: any[] = [];

    if (filterProvider) {
        query += ' AND provider = ?';
        params.push(filterProvider);
    }
    if (filterModel) {
        query += ' AND model = ?';
        params.push(filterModel);
    }
    if (filterTaskType) {
        query += ' AND task_type = ?';
        params.push(filterTaskType);
    }

    query += ` GROUP BY model, provider, task_type ORDER BY total_runs DESC`;

    const rows = db.prepare(query).all(...params);

    return rows.map((row: any) => ({
        model: row.model,
        provider: row.provider,
        taskType: row.task_type,
        totalRuns: row.total_runs,
        successfulRuns: row.successful_runs,
        successRate: row.success_rate,
        avgLatencyMs: Math.round(row.avg_latency_ms || 0),
        avgInputTokens: Math.round(row.avg_input_tokens || 0),
        avgOutputTokens: Math.round(row.avg_output_tokens || 0),
        avgTokens: Math.round(row.avg_token_count || 0),
    }));
}

export function clearUsageStats(db: any) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM model_performance').run();
    return true;
}
