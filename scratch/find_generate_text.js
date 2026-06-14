import * as fs from 'fs';

const dtsPath = 'node_modules/ai/dist/index.d.ts';
if (fs.existsSync(dtsPath)) {
    const content = fs.readFileSync(dtsPath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export declare function generateText') || lines[i].includes('declare function generateText')) {
            console.log(`${i+1}: ${lines[i].trim()}`);
            // print 30 lines after
            for (let j = i; j <= Math.min(lines.length - 1, i + 30); j++) {
                console.log(`  [L${j+1}]: ${lines[j]}`);
            }
        }
    }
}
