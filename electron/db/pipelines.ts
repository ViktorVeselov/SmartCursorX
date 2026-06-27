export interface PipelinePresetRow {
    id: number;
    name: string;
    config: string;
    created_at: string;
}

export function createPipelinePresetsTable(db: any): void {
    if (!db) return;
    db.prepare(`
        CREATE TABLE IF NOT EXISTS pipeline_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            config TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

export function addPipelinePreset(db: any, name: string, config: object): PipelinePresetRow {
    const stmt = db.prepare('INSERT INTO pipeline_presets (name, config) VALUES (?, ?)');
    const result = stmt.run(name, JSON.stringify(config));
    return { id: result.lastInsertRowid, name, config: JSON.stringify(config), created_at: new Date().toISOString() };
}

export function getPipelinePresets(db: any): PipelinePresetRow[] {
    return db.prepare('SELECT id, name, config, created_at FROM pipeline_presets ORDER BY name').all();
}

export function getPipelinePreset(db: any, id: number): PipelinePresetRow | undefined {
    return db.prepare('SELECT id, name, config, created_at FROM pipeline_presets WHERE id = ?').get(id);
}

export function deletePipelinePreset(db: any, id: number): void {
    db.prepare('DELETE FROM pipeline_presets WHERE id = ?').run(id);
}

export function updatePipelinePreset(db: any, id: number, name: string, config: object): void {
    db.prepare('UPDATE pipeline_presets SET name = ?, config = ? WHERE id = ?').run(name, JSON.stringify(config), id);
}
