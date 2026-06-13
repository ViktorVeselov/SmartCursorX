import { checkArgs, assertNonNull } from '../../src/helpers/invariant';

export function createConversation(db: any, id: string, title: string, model: string, provider: string, workspacePath?: string) {
    checkArgs(typeof id === 'string', 'id must be a string');
    checkArgs(typeof title === 'string', 'title must be a string');
    checkArgs(typeof model === 'string', 'model must be a string');
    checkArgs(typeof provider === 'string', 'provider must be a string');
    if (!db) throw new Error('DB not initialized');
    db.prepare('INSERT OR REPLACE INTO conversations (id, title, model, provider, workspace_path) VALUES (?, ?, ?, ?, ?)')
        .run(id, title, model, provider, workspacePath || null);
    return id;
}

export function getConversations(db: any, workspacePath?: string) {
    if (!db) return [];
    if (workspacePath && workspacePath.trim().length > 0) {
        return db.prepare('SELECT * FROM conversations WHERE workspace_path = ? ORDER BY updated_at DESC').all(workspacePath);
    } else {
        return db.prepare('SELECT * FROM conversations WHERE workspace_path IS NULL OR workspace_path = \'\' ORDER BY updated_at DESC').all();
    }
}

export function getConversationMessages(db: any, conversationId: string) {
    if (!db) return [];
    return db.prepare('SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC')
        .all(conversationId);
}

export function addChatMessage(db: any, conversationId: string, role: string, content: string) {
    if (!db) throw new Error('DB not initialized');

    const conv = db.prepare('SELECT id FROM conversations WHERE id = ?').get(conversationId);
    if (!conv) {
        console.warn(`[DatabaseService] Conversation ${conversationId} does not exist. Skipping message save.`);
        return false;
    }
    assertNonNull(conv, 'Conversation from db.get in addChatMessage');

    const info = db.prepare('INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)')
        .run(conversationId, role, content);

    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(conversationId);

    return info.lastInsertRowid;
}

export function updateChatMessage(db: any, conversationId: string, messageId: number, content: string) {
    checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
    checkArgs(typeof messageId === 'number', 'messageId must be a number');
    checkArgs(typeof content === 'string', 'content must be a string');
    if (!db) throw new Error('DB not initialized');

    const result = db.prepare('UPDATE chat_messages SET content = ? WHERE conversation_id = ? AND id = ?')
        .run(content, conversationId, messageId);

    if (result.changes > 0) {
        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(conversationId);
    }

    return result.changes > 0;
}

export function truncateChatMessages(db: any, conversationId: string, messageId: number) {
    checkArgs(typeof conversationId === 'string', 'conversationId must be a string');
    checkArgs(typeof messageId === 'number', 'messageId must be a number');
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM chat_messages WHERE conversation_id = ? AND id > ?')
        .run(conversationId, messageId);
}

export function touchConversation(db: any, conversationId: string) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(conversationId);
}

export function deleteConversation(db: any, conversationId: string) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
    return true;
}

export function updateConversationTitle(db: any, conversationId: string, title: string) {
    if (!db) throw new Error('DB not initialized');
    db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(title, conversationId);
    return true;
}
