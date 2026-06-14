import * as fs from 'fs';
import * as path from 'path';

const filePath = 'electron/services/taxonomy/taxonomyTree.json';
if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    function walk(node) {
        if (node.toolOverrides && node.toolOverrides.length > 0) {
            console.log(`Node: ${node.id} has tool overrides:`, node.toolOverrides);
        }
        if (node.children) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }
    
    for (const tree of Object.values(data)) {
        walk(tree);
    }
} else {
    console.log('taxonomyTree.json not found');
}
