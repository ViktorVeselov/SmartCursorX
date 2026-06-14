import * as fs from 'fs';

const dtsPath = 'node_modules/ai/dist/index.d.ts';
if (fs.existsSync(dtsPath)) {
    const content = fs.readFileSync(dtsPath, 'utf-8');
    const index = content.indexOf('declare function generateText');
    if (index !== -1) {
        console.log(content.substring(index, index + 8000));
    }
}
