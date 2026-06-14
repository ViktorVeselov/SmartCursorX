import * as fs from 'fs';
import * as path from 'path';

const dtsPaths = [
    'node_modules/ai/dist/index.d.ts',
    'node_modules/@ai-sdk/provider-utils/dist/index.d.ts',
];

for (const dtsPath of dtsPaths) {
    if (fs.existsSync(dtsPath)) {
        console.log(`Checking ${dtsPath}...`);
        const content = fs.readFileSync(dtsPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('function tool') || lines[i].includes('const tool') || lines[i].includes('export { tool') || lines[i].includes('tool:')) {
                console.log(`${i+1}: ${lines[i].trim()}`);
                // print surrounding lines
                for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 5); j++) {
                    console.log(`  [L${j+1}]: ${lines[j]}`);
                }
                console.log('---');
            }
        }
    }
}
