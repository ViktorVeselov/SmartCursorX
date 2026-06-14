import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'smart-cursor-x', 'cursor-replacer.sqlite');
console.log('Opening database at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT * FROM task_plans ORDER BY created_at DESC LIMIT 1').get();
    if (row) {
        console.log('Task ID:', row.task_id);
        console.log('Status:', row.status);
        console.log('Confidence:', row.confidence);
        console.log('Created At:', row.created_at);
        console.log('Plan JSON:', JSON.stringify(JSON.parse(row.plan_json), null, 2));
    } else {
        console.log('No plan found in task_plans.');
    }
} catch (err) {
    console.error('Error opening DB:', err);
    // try fallback path
    const dbPathFallback = path.join(os.homedir(), 'AppData', 'Roaming', 'cursor-replacer', 'cursor-replacer.sqlite');
    console.log('Opening fallback database at:', dbPathFallback);
    try {
        const db = new Database(dbPathFallback, { readonly: true });
        const row = db.prepare('SELECT * FROM task_plans ORDER BY created_at DESC LIMIT 1').get();
        if (row) {
            console.log('Task ID:', row.task_id);
            console.log('Status:', row.status);
            console.log('Confidence:', row.confidence);
            console.log('Created At:', row.created_at);
            console.log('Plan JSON:', JSON.stringify(JSON.parse(row.plan_json), null, 2));
        } else {
            console.log('No plan found in fallback task_plans.');
        }
    } catch (err2) {
        console.error('Fallback failed:', err2);
    }
}
