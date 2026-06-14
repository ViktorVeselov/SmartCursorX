import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

// Path to the sqlite database in Roaming appData
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'smart-cursor-x', 'cursor-replacer.sqlite');
const db = new Database(dbPath, { readonly: true });

try {
    const plans = db.prepare('SELECT * FROM task_plans ORDER BY id DESC LIMIT 5').all();
    for (const p of plans) {
        console.log(`=========================================`);
        console.log(`Plan ID: ${p.id}, Task ID: ${p.task_id}, Status: ${p.status}`);
        const parsed = JSON.parse(p.plan_json);
        console.log(`Keys in plan_json:`, Object.keys(parsed));
        console.log(`designDoc (truncated):`, parsed.designDoc ? parsed.designDoc.substring(0, 300) : 'None');
        console.log(`tradeoffs:`, parsed.tradeoffs);
        console.log(`consequences:`, parsed.consequences);
        console.log(`planningTradeoffs:`, parsed.planningTradeoffs);
        console.log(`planningConsequences:`, parsed.planningConsequences);
    }
} catch (e) {
    console.error('Error reading database:', e);
}
