import * as fs from 'fs';

const dtsPath = 'node_modules/ai/dist/index.d.ts';
if (fs.existsSync(dtsPath)) {
    const content = fs.readFileSync(dtsPath, 'utf-8');
    const index = content.indexOf('interface GenerateTextResult');
    if (index !== -1) {
        console.log(content.substring(index, index + 3000));
    } else {
        const index2 = content.indexOf('class GenerateTextResult');
        if (index2 !== -1) {
            console.log(content.substring(index2, index2 + 3000));
        } else {
            const index3 = content.indexOf('type GenerateTextResult');
            if (index3 !== -1) {
                console.log(content.substring(index3, index3 + 3000));
            } else {
                console.log('Not found, searching dynamically...');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('GenerateTextResult')) {
                        console.log(`${i+1}: ${lines[i].trim()}`);
                    }
                }
            }
        }
    }
}
