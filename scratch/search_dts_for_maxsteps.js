import * as fs from 'fs';
import * as path from 'path';

function searchFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('maxSteps')) {
        console.log(`Found in ${filePath}`);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('maxSteps')) {
                console.log(`  L${i+1}: ${lines[i].trim()}`);
            }
        }
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' || dir.includes('ai') || dir.includes('@ai-sdk')) {
                walkDir(fullPath);
            }
        } else if (file.endsWith('.d.ts')) {
            searchFile(fullPath);
        }
    }
}

walkDir('node_modules/ai');
walkDir('node_modules/@ai-sdk');
