import * as fs from 'fs';

const filePath = 'node_modules/ai/src/generate-text/generate-text.ts';
if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('maxSteps') || lines[i].includes('stopWhen') || lines[i].includes('stopConditions')) {
            console.log(`L${i+1}: ${lines[i].trim()}`);
        }
    }
}
