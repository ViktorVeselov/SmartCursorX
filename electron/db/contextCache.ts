const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getCachedContext(db: any, modelKey: string): number | null {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT context_length, cached_at FROM context_cache WHERE model_key = ?').get(modelKey);
    if (!row) return null;
    const age = Date.now() - row.cached_at;
    if (age > CACHE_TTL_MS) {
      db.prepare('DELETE FROM context_cache WHERE model_key = ?').run(modelKey);
      return null;
    }
    return row.context_length;
  } catch {
    return null;
  }
}

export function setCachedContext(db: any, modelKey: string, contextLength: number) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO context_cache (model_key, context_length, cached_at)
      VALUES (?, ?, ?)
      ON CONFLICT(model_key) DO UPDATE SET context_length = excluded.context_length, cached_at = excluded.cached_at
    `).run(modelKey, contextLength, Date.now());
  } catch (e) {
    console.warn('[contextCache] Failed to cache context length:', e);
  }
}

export function logCompression(
  db: any,
  conversationId: string,
  model: string,
  tokensBefore: number,
  tokensAfter: number,
  strategy: string,
  details?: string
) {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO compression_log (conversation_id, model, compressed_at, tokens_before, tokens_after, strategy, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(conversationId, model, Date.now(), tokensBefore, tokensAfter, strategy, details || null);
  } catch (e) {
    console.warn('[contextCache] Failed to log compression:', e);
  }
}

export function getCompressionLog(db: any, conversationId?: string) {
  if (!db) return [];
  try {
    if (conversationId) {
      return db.prepare('SELECT * FROM compression_log WHERE conversation_id = ? ORDER BY compressed_at DESC').all(conversationId);
    }
    return db.prepare('SELECT * FROM compression_log ORDER BY compressed_at DESC LIMIT 50').all();
  } catch {
    return [];
  }
}
