import {
  TaxonomyNode,
  TaxonomyPath,
  ClassificationSignals,
  ContextMultipliers,
  ActivationThresholds
} from './types';

export const DEFAULT_MULTIPLIERS: ContextMultipliers = {
  taskTitle: 2.0,
  taskDescription: 1.5,
  fileName: 1.8,
  directoryName: 1.5,
  importStatement: 2.5,
  packageJson: 2.0,
  codeSymbol: 1.5,
  codeBody: 0.8,
  comment: 0.5,
  stringLiteral: 0.3,
  agentThought: 1.8
};

export const DEFAULT_THRESHOLDS: ActivationThresholds = {
  activationThreshold: 0.6,
  depthThresholds: {
    1: 0.4,
    2: 0.5,
    3: 0.65,
    4: 0.75,
    5: 0.85
  },
  siblingAmbiguityBand: 0.15,
  complexityGate: {
    minTitleWords: 3,
    minFilesModified: 1,
    minPlanSteps: 2
  }
};

export class TaxonomyClassifier {
  static shouldActivateTaxonomy(task: any, plan?: any, thresholds = DEFAULT_THRESHOLDS): boolean {
    if (!task || !task.title) return false;

    const titleWords = task.title.trim().split(/\s+/).filter(Boolean).length;
    if (titleWords < thresholds.complexityGate.minTitleWords) return false;

    const trivialPatterns = /^(rename|typo|comment|format|indent|whitespace|spelling)/i;
    if (trivialPatterns.test(task.title)) return false;

    if (plan) {
      const parsedPlan = typeof plan === 'string' ? JSON.parse(plan) : plan;
      const stepsCount = parsedPlan.steps ? parsedPlan.steps.length : 0;
      const filesCount = parsedPlan.filesToModify ? parsedPlan.filesToModify.length : 0;

      if (stepsCount > 0 && stepsCount < thresholds.complexityGate.minPlanSteps) return false;
      if (filesCount > 0 && filesCount < thresholds.complexityGate.minFilesModified) return false;
    }

    return true;
  }

  static gatherSignals(
    task: any,
    plan?: any,
    investigationResults?: string,
    fileContentsMap?: Record<string, string>,
    packageJsonDeps: string[] = []
  ): ClassificationSignals {
    const title = task?.title || '';
    const description = task?.description || '';

    const fileNames: string[] = [];
    const directoryPaths: string[] = [];
    const importStatements: string[] = [];
    const codeSymbols: string[] = [];
    const comments: string[] = [];
    const stringLiterals: string[] = [];
    let codeBody = '';

    if (plan) {
      const parsedPlan = typeof plan === 'string' ? JSON.parse(plan) : plan;
      if (parsedPlan.filesToModify && Array.isArray(parsedPlan.filesToModify)) {
        for (const file of parsedPlan.filesToModify) {
          const baseName = file.split(/[/\\]/).pop() || '';
          fileNames.push(baseName);
          const dirName = file.split(/[/\\]/).slice(0, -1).join('/') || '';
          if (dirName) directoryPaths.push(dirName);
        }
      }
    }

    if (fileContentsMap) {
      for (const [filePath, content] of Object.entries(fileContentsMap)) {
        const baseName = filePath.split(/[/\\]/).pop() || '';
        if (!fileNames.includes(baseName)) {
          fileNames.push(baseName);
        }
        const dirName = filePath.split(/[/\\]/).slice(0, -1).join('/') || '';
        if (dirName && !directoryPaths.includes(dirName)) {
          directoryPaths.push(dirName);
        }

        codeBody += '\n' + content;

        // Simple line-by-line checks for imports, comments, string literals
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('import ') || trimmed.startsWith('const ') && trimmed.includes('require(')) {
            importStatements.push(trimmed);
          }
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.endsWith('*/')) {
            comments.push(trimmed);
          }
          const strings = trimmed.match(/(["'`])(.*?)\1/g);
          if (strings) {
            for (const str of strings) {
              stringLiterals.push(str);
            }
          }
        }
      }
    }

    // Try extracting symbols if we see declarations in the code
    if (codeBody) {
      const classMatches = codeBody.match(/class\s+([a-zA-Z0-9_$]+)/g);
      if (classMatches) {
        for (const m of classMatches) {
          const sym = m.split(/\s+/)[1];
          if (sym) codeSymbols.push(sym);
        }
      }
      const funcMatches = codeBody.match(/function\s+([a-zA-Z0-9_$]+)/g);
      if (funcMatches) {
        for (const m of funcMatches) {
          const sym = m.split(/\s+/)[1];
          if (sym) codeSymbols.push(sym);
        }
      }
      const constMatches = codeBody.match(/const\s+([a-zA-Z0-9_$]+)\s*=/g);
      if (constMatches) {
        for (const m of constMatches) {
          const parts = m.split(/\s+/);
          const sym = parts[1];
          if (sym && sym !== '=') codeSymbols.push(sym);
        }
      }
    }

    const agentThoughts: string[] = investigationResults ? [investigationResults] : [];

    return {
      taskTitle: title,
      taskDescription: description,
      fileNames,
      directoryPaths,
      importStatements,
      packageJsonDeps,
      codeSymbols,
      codeBody,
      comments,
      stringLiterals,
      agentThoughts
    };
  }

  static scoreNode(
    node: TaxonomyNode,
    signals: ClassificationSignals,
    multipliers = DEFAULT_MULTIPLIERS,
    depth = 1
  ): number {
    let score = 0.0;
    const triggers = node.triggers;
    if (!triggers) return 0.0;

    const checkTextContainsWord = (text: string, word: string): boolean => {
      const cleanWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${cleanWord}\\b`, 'i');
      return regex.test(text);
    };

    const countMatches = (list: string[], term: string, isWord = true): number => {
      let count = 0;
      for (const item of list) {
        if (isWord) {
          if (checkTextContainsWord(item, term)) count++;
        } else {
          if (item.toLowerCase().includes(term.toLowerCase())) count++;
        }
      }
      return count;
    };

    // 1. Word Triggers
    if (triggers.words) {
      for (const w of triggers.words) {
        // title
        if (checkTextContainsWord(signals.taskTitle, w.word)) {
          score += w.weight * multipliers.taskTitle;
        }
        // description
        if (checkTextContainsWord(signals.taskDescription, w.word)) {
          score += w.weight * multipliers.taskDescription;
        }
        // file names
        for (const fName of signals.fileNames) {
          if (checkTextContainsWord(fName, w.word)) {
            score += w.weight * multipliers.fileName;
          }
        }
        // directory paths
        for (const dir of signals.directoryPaths) {
          if (checkTextContainsWord(dir, w.word)) {
            score += w.weight * multipliers.directoryName;
          }
        }
        // imports
        if (countMatches(signals.importStatements, w.word) > 0) {
          score += w.weight * multipliers.importStatement;
        }
        // package.json dependencies
        if (countMatches(signals.packageJsonDeps, w.word) > 0) {
          score += w.weight * multipliers.packageJson;
        }
        // symbols
        if (countMatches(signals.codeSymbols, w.word) > 0) {
          score += w.weight * multipliers.codeSymbol;
        }
        // code body
        if (checkTextContainsWord(signals.codeBody, w.word)) {
          score += w.weight * multipliers.codeBody;
        }
        // comments
        if (countMatches(signals.comments, w.word) > 0) {
          score += w.weight * multipliers.comment;
        }
        // string literals
        if (countMatches(signals.stringLiterals, w.word) > 0) {
          score += w.weight * multipliers.stringLiteral;
        }
        // agent thoughts
        for (const thought of signals.agentThoughts) {
          if (checkTextContainsWord(thought, w.word)) {
            score += w.weight * multipliers.agentThought;
          }
        }
      }
    }

    // 2. Phrase Triggers
    if (triggers.phrases) {
      for (const p of triggers.phrases) {
        const matchesPhrase = (text: string) => text.toLowerCase().includes(p.phrase.toLowerCase());
        if (matchesPhrase(signals.taskTitle)) score += p.weight * multipliers.taskTitle;
        if (matchesPhrase(signals.taskDescription)) score += p.weight * multipliers.taskDescription;
        for (const fName of signals.fileNames) {
          if (matchesPhrase(fName)) score += p.weight * multipliers.fileName;
        }
        for (const dir of signals.directoryPaths) {
          if (matchesPhrase(dir)) score += p.weight * multipliers.directoryName;
        }
        if (countMatches(signals.importStatements, p.phrase, false) > 0) score += p.weight * multipliers.importStatement;
        if (countMatches(signals.packageJsonDeps, p.phrase, false) > 0) score += p.weight * multipliers.packageJson;
        if (countMatches(signals.codeSymbols, p.phrase, false) > 0) score += p.weight * multipliers.codeSymbol;
        if (matchesPhrase(signals.codeBody)) score += p.weight * multipliers.codeBody;
        if (countMatches(signals.comments, p.phrase, false) > 0) score += p.weight * multipliers.comment;
        if (countMatches(signals.stringLiterals, p.phrase, false) > 0) score += p.weight * multipliers.stringLiteral;
        for (const thought of signals.agentThoughts) {
          if (matchesPhrase(thought)) score += p.weight * multipliers.agentThought;
        }
      }
    }

    // 3. Anti-word suppression
    if (triggers.antiWords) {
      for (const aw of triggers.antiWords) {
        if (checkTextContainsWord(signals.taskTitle, aw.word) ||
            checkTextContainsWord(signals.taskDescription, aw.word) ||
            signals.fileNames.some(f => checkTextContainsWord(f, aw.word))) {
          score += aw.weight; // aw.weight is negative
        }
      }
    }

    // 4. Import Patterns
    if (triggers.importPatterns) {
      for (const imp of triggers.importPatterns) {
        const normalizedImp = imp.toLowerCase().replace(/['"]/g, "'");
        if (signals.importStatements.some(line => line.toLowerCase().replace(/['"]/g, "'").includes(normalizedImp))) {
          score += 2.0; // Import pattern match bonus
        }
      }
    }

    // 5. File Patterns
    if (triggers.filePatterns) {
      for (const pat of triggers.filePatterns) {
        const regexPat = pat.replace(/\*\*/g, '.*').replace(/\*/g, '[^/\\\\]*');
        const regex = new RegExp(`^${regexPat}$`, 'i');
        // Check relative paths or filenames
        if (signals.fileNames.some(f => regex.test(f)) || signals.directoryPaths.some(d => regex.test(d))) {
          score += 1.5;
        }
      }
    }

    // 6. Symbol Patterns
    if (triggers.symbolPatterns) {
      for (const sym of triggers.symbolPatterns) {
        if (signals.codeSymbols.some(s => s.toLowerCase() === sym.toLowerCase())) {
          score += 1.0;
        }
      }
    }

    // Depth Penalty
    const depthPenalty = 1.0 / (1.0 + (depth * 0.15));
    return score * depthPenalty;
  }

  static classifyAxis(
    axisName: string,
    axisTree: TaxonomyNode,
    signals: ClassificationSignals,
    thresholds = DEFAULT_THRESHOLDS,
    multipliers = DEFAULT_MULTIPLIERS
  ): TaxonomyPath | null {
    let currentNode = axisTree;
    const pathIds: string[] = [];

    // Traverse down the tree
    while (currentNode) {
      if (currentNode.children.length === 0) {
        break; // reached leaf
      }

      const childScores = new Map<TaxonomyNode, number>();
      for (const child of currentNode.children) {
        const childDepth = pathIds.length + 1;
        const score = this.scoreNode(child, signals, multipliers, childDepth);
        childScores.set(child, score);
      }

      const sorted = [...childScores.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) break;

      const [topNode, topScore] = sorted[0];
      const currentDepth = pathIds.length + 1;
      const requiredThreshold = thresholds.depthThresholds[currentDepth] || thresholds.activationThreshold;

      if (topScore < requiredThreshold) {
        break; // score too low, do not descend
      }

      // Check sibling ambiguity
      if (sorted.length >= 2) {
        const [, secondScore] = sorted[1];
        if (topScore - secondScore < thresholds.siblingAmbiguityBand) {
          break; // too ambiguous, stay at parent
        }
      }

      currentNode = topNode;
      pathIds.push(currentNode.id);
    }

    if (pathIds.length === 0) {
      return null; // did not descend from root
    }

    // Compute average confidence based on the path depth
    const totalScore = pathIds.reduce((sum, id, index) => {
      const node = this.findNodeInSubtree(axisTree, id);
      return sum + (node ? this.scoreNode(node, signals, multipliers, index + 1) : 0.0);
    }, 0.0);

    const confidence = Math.min(1.0, totalScore / pathIds.length);

    return {
      axisName,
      nodeIds: pathIds,
      deepestNode: currentNode,
      confidence,
      depth: pathIds.length
    };
  }

  static findNodeInSubtree(root: TaxonomyNode, id: string): TaxonomyNode | null {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = this.findNodeInSubtree(child, id);
      if (found) return found;
    }
    return null;
  }
}
