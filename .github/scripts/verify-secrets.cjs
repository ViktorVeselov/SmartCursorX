const fs = require('fs');
const path = require('path');

// Regex patterns to check for secrets
const PATTERNS = {
  'OpenAI API Key': /sk-[a-zA-Z0-9]{48}|sk-proj-[a-zA-Z0-9]{48,}/g,
  'GitHub Personal Access Token': /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{82}/g,
  'JSON Web Token (JWT)': /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  'Generic API Key/Credential Assignment': /(?:api_key|apikey|secret|token|password|auth_token)\s*=\s*['"]([a-zA-Z0-9_-]{10,})['"]/gi,
  'Private Key Boundary': /-----BEGIN (?:RSA |EC |)?PRIVATE KEY-----/g
};

// Paths to completely ignore
const IGNORE_DIRS = [
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  'target',
  '.git',
  '.idea',
  '.vscode'
];

const IGNORE_FILES = [
  'verify-secrets.cjs',
  'package-lock.json',
  '.gitignore',
  'README.md'
];

// Helper to mask secrets in console output
function maskSecret(secret, type) {
  if (type === 'Generic API Key/Credential Assignment') {
    const match = secret.match(/(?:api_key|apikey|secret|token|password|auth_token)\s*=\s*['"]([a-zA-Z0-9_-]+)['"]/i);
    if (match && match[1]) {
      const val = match[1];
      return secret.replace(val, val.substring(0, 3) + '...' + val.substring(val.length - 3));
    }
  }
  return secret.substring(0, 8) + '...' + secret.substring(secret.length - 4);
}

function shouldIgnore(filePath) {
  const parts = filePath.split(path.sep);
  
  // Ignore specified directories
  if (parts.some(part => IGNORE_DIRS.includes(part))) {
    return true;
  }
  
  // Ignore markdown files and specified files
  const baseName = path.basename(filePath);
  if (baseName.endsWith('.md') || IGNORE_FILES.includes(baseName)) {
    return true;
  }
  
  return false;
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      if (!shouldIgnore(fullPath)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const [name, regex] of Object.entries(PATTERNS)) {
      regex.lastIndex = 0;
      const matches = line.match(regex);
      
      if (matches) {
        for (const match of matches) {
          if (name === 'Generic API Key/Credential Assignment') {
            const placeholderMatch = match.toLowerCase();
            if (placeholderMatch.includes('your_') || placeholderMatch.includes('placeholder') || placeholderMatch.includes('example')) {
              continue; 
            }
          }
          
          findings.push({
            line: i + 1,
            type: name,
            match: maskSecret(match, name)
          });
        }
      }
    }
  }

  return findings;
}

function main() {
  const projectRoot = path.resolve(__dirname, '../..');
  console.log(`🔍 Starting deterministic secret scan in: ${projectRoot}`);
  
  let files;
  try {
    files = walkDir(projectRoot);
  } catch (err) {
    console.error('❌ Error scanning directory:', err.message);
    process.exit(1);
  }

  console.log(`Scanning ${files.length} source files...`);
  
  let totalIssues = 0;
  
  for (const file of files) {
    try {
      const findings = scanFile(file);
      if (findings.length > 0) {
        const relativePath = path.relative(projectRoot, file);
        console.log(`\n⚠️  Potential Secret Found in [${relativePath}]:`);
        findings.forEach(f => {
          console.log(`   └─ Line ${f.line} [${f.type}]: "${f.match.trim()}"`);
          totalIssues++;
        });
      }
    } catch (err) {
      console.warn(`⚠️  Could not read file ${file}: ${err.message}`);
    }
  }

  console.log('\n----------------------------------------');
  if (totalIssues > 0) {
    console.log(`❌ SCAN FAILED: Found ${totalIssues} potential credentials/secrets.`);
    process.exit(1);
  } else {
    console.log('✅ SCAN PASSED: No secrets or credentials detected in code or comments.');
    process.exit(0);
  }
}

main();
