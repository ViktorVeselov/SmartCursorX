import { ExpertFragment, DecisionNode, ClassificationSignals, CrossAxisRule } from './types';

export class FragmentRenderer {
  static renderFragment(fragment: ExpertFragment, _signals: ClassificationSignals): string {
    const lines: string[] = [];

    // Header
    lines.push(`### GUIDANCE [${fragment.weight.toUpperCase()}]: ${fragment.summary}`);

    // Deference Clause (Non-Negotiable)
    if (fragment.defersToCodebase) {
      lines.push(`*Deference Policy: If existing patterns in the codebase address this concern, follow the existing pattern unless it has a known deficiency.*`);
    }

    // Core Guidance
    lines.push(fragment.coreGuidance);

    // Decision Tree
    if (fragment.decisionTree) {
      lines.push('\n**Decision Flowchart:**');
      lines.push(this.renderDecisionTree(fragment.decisionTree, 0));
    }

    // Code Patterns
    if (fragment.codePatterns && fragment.codePatterns.length > 0) {
      lines.push('\n**Code Examples:**');
      for (const pattern of fragment.codePatterns) {
        lines.push(`*Concern: ${pattern.concern}*`);
        lines.push(`❌ **DON'T (Wrong):**\n\`\`\`${pattern.wrong.language}\n${pattern.wrong.code}\n\`\`\`\n*Why: ${pattern.wrong.explanation}*\n`);
        lines.push(`✅ **DO (Correct):**\n\`\`\`${pattern.correct.language}\n${pattern.correct.code}\n\`\`\`\n*Why: ${pattern.correct.explanation}*`);
        if (pattern.detectionHint) {
          lines.push(`*Detection Hint: ${pattern.detectionHint}*`);
        }
        lines.push('');
      }
    }

    // Common Mistakes
    if (fragment.commonMistakes && fragment.commonMistakes.length > 0) {
      lines.push('\n**Common Mistakes to Avoid:**');
      for (const mistake of fragment.commonMistakes) {
        lines.push(`- **[${mistake.severity.toUpperCase()}]** ${mistake.mistake}`);
        lines.push(`  *Why it happens:* ${mistake.whyItHappens}`);
        lines.push(`  *Correction:* ${mistake.correction}`);
      }
    }

    // Guardrails
    if (fragment.guardrails && fragment.guardrails.length > 0) {
      lines.push('\n**Hard Guardrails:**');
      for (const guard of fragment.guardrails) {
        lines.push(`🚫 **NEVER:** ${guard.rule}`);
        lines.push(`  *Rationale:* ${guard.rationale}`);
        lines.push(`  *Alternative:* ${guard.alternative}`);
      }
    }

    // Scaffolding
    if (fragment.scaffolding && fragment.scaffolding.length > 0) {
      lines.push('\n**Step-by-Step Scaffolding:**');
      const sortedScaffold = [...fragment.scaffolding].sort((a, b) => a.stepNumber - b.stepNumber);
      for (const step of sortedScaffold) {
        lines.push(`${step.stepNumber}. **Instruction:** ${step.instruction}`);
        lines.push(`   *Expected Output:* ${step.expectedOutput}`);
        if (step.dependsOn && step.dependsOn.length > 0) {
          lines.push(`   *Depends on steps:* [${step.dependsOn.join(', ')}]`);
        }
        if (step.pitfalls && step.pitfalls.length > 0) {
          lines.push(`   *Pitfalls:* ${step.pitfalls.join('; ')}`);
        }
      }
    }

    // Self-Verification Checks
    if (fragment.selfVerification && fragment.selfVerification.length > 0) {
      lines.push('\n**Self-Verification Checklist:**');
      for (const check of fragment.selfVerification) {
        lines.push(`[ ] **Check:** ${check.check}`);
        lines.push(`    *How to verify:* ${check.howToVerify}`);
        lines.push(`    *Failure indicator:* ${check.failureIndicator}`);
        lines.push(`    *Remediation:* ${check.remediation}`);
      }
    }

    return lines.join('\n');
  }

  static renderDecisionTree(node: DecisionNode, indent: number): string {
    const spaces = ' '.repeat(indent * 2);
    let result = `${spaces}IF: ${node.condition}\n`;

    const renderBranch = (branch: DecisionNode | string, type: 'YES' | 'NO'): string => {
      const branchSpaces = ' '.repeat((indent + 1) * 2);
      if (typeof branch === 'string') {
        return `${branchSpaces}${type} → ${branch}\n`;
      } else {
        return `${branchSpaces}${type} →\n${this.renderDecisionTree(branch, indent + 2)}`;
      }
    };

    result += renderBranch(node.ifTrue, 'YES');
    result += renderBranch(node.ifFalse, 'NO');
    return result;
  }

  static renderSlotBlock(
    fragments: ExpertFragment[],
    axisName: string,
    resolvedPath: string,
    signals: ClassificationSignals,
    matchedRules: CrossAxisRule[] = []
  ): string {
    if (fragments.length === 0 && matchedRules.length === 0) return '';

    const lines: string[] = [];
    lines.push(`\n=== TAXONOMY DOMAIN AWARENESS: ${axisName.toUpperCase()} (${resolvedPath}) ===`);

    const alwaysTriggered = fragments.filter(f => f.trigger === 'always');
    const conditionalTriggered = fragments.filter(f => {
      if (f.trigger !== 'conditional') return false;
      if (!f.conditionalSignals || f.conditionalSignals.length === 0) return false;
      // Check if any conditional signal is found in code body or task descriptions
      const signalsSource = `${signals.taskTitle} ${signals.taskDescription} ${signals.codeBody}`.toLowerCase();
      return f.conditionalSignals.some(sig => signalsSource.includes(sig.toLowerCase()));
    });

    const activeFragments = [...alwaysTriggered, ...conditionalTriggered];

    // Sort by weight: critical -> principle -> awareness
    const weightPriority = { critical: 0, principle: 1, awareness: 2 };
    activeFragments.sort((a, b) => weightPriority[a.weight] - weightPriority[b.weight]);

    for (const fragment of activeFragments) {
      lines.push(this.renderFragment(fragment, signals));
      lines.push('');
    }

    if (matchedRules.length > 0) {
      lines.push('**Cross-Axis Rules Activated:**');
      for (const rule of matchedRules) {
        lines.push(`- *Between ${rule.axis1Path} and ${rule.axis2Path}*`);
        lines.push(`  *Resolution:* ${rule.resolution}`);
        lines.push(`  *Guidance:* ${rule.intersectionGuidance}`);
      }
      lines.push('');
    }

    lines.push(`=== END TAXONOMY AWARENESS: ${axisName.toUpperCase()} ===`);
    return lines.join('\n');
  }
}
