export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift',
    html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
    md: 'markdown', sql: 'sql', sh: 'shell', ps1: 'powershell'
  };
  return langMap[ext || ''] || 'plaintext';
}

export function getFileSettings(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const language = getLanguageFromExtension(filename);
  let tabSize = 4;
  if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss', 'yaml', 'yml', 'md'].includes(ext)) {
    tabSize = 2;
  }
  return { language, tabSize };
}
