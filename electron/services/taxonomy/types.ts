// === TRIGGER TYPES ===
export interface TaxonomyTriggers {
  words: WordTrigger[];
  phrases: PhraseTrigger[];
  antiWords: AntiWordTrigger[];
  importPatterns: string[];
  filePatterns: string[];
  symbolPatterns: string[];
}

export interface WordTrigger {
  word: string;
  weight: number;  // 0.0–1.0
}

export interface PhraseTrigger {
  phrase: string;
  weight: number;
}

export interface AntiWordTrigger {
  word: string;
  weight: number;  // negative
}

// === FRAGMENT TYPES ===
export type FragmentWeight = 'awareness' | 'principle' | 'critical';
export type FragmentTrigger = 'always' | 'conditional';
export type OperationalContext = 'chat' | 'planning' | 'taskCreation' | 'investigation' | 'execution' | 'verification';
export type MistakeSeverity = 'cosmetic' | 'functional' | 'security' | 'data-loss';

export interface ExpertFragment {
  id: string;
  summary: string;
  weight: FragmentWeight;
  trigger: FragmentTrigger;
  conditionalSignals?: string[];
  defersToCodebase: boolean;
  
  coreGuidance: string;
  decisionTree: DecisionNode | null;
  codePatterns: CodePatternPair[] | null;
  commonMistakes: MistakeEntry[] | null;
  selfVerification: VerificationCheck[] | null;
  outputConstraints: string[] | null;
  guardrails: Guardrail[] | null;
  scaffolding: ScaffoldStep[] | null;
  crossReferences: string[] | null;
}

export interface DecisionNode {
  condition: string;
  ifTrue: DecisionNode | string;
  ifFalse: DecisionNode | string;
}

export interface CodePatternPair {
  concern: string;
  wrong: { code: string; language: string; explanation: string; };
  correct: { code: string; language: string; explanation: string; };
  detectionHint: string;
}

export interface MistakeEntry {
  mistake: string;
  whyItHappens: string;
  correction: string;
  severity: MistakeSeverity;
}

export interface VerificationCheck {
  check: string;
  howToVerify: string;
  failureIndicator: string;
  remediation: string;
}

export interface Guardrail {
  rule: string;
  rationale: string;
  alternative: string;
}

export interface ScaffoldStep {
  stepNumber: number;
  instruction: string;
  expectedOutput: string;
  dependsOn: number[];
  pitfalls: string[];
}

// === TREE TYPES ===
export interface TaxonomyNode {
  id: string;
  label: string;
  children: TaxonomyNode[];
  triggers: TaxonomyTriggers;
  fragments: Record<OperationalContext, ExpertFragment[] | null>;
  toolOverrides: ToolDescriptionOverride[];
}

export interface ToolDescriptionOverride {
  toolId: string;
  taxonomyPath: string;
  description: string;
}

// === CLASSIFICATION TYPES ===
export interface ClassificationSignals {
  taskTitle: string;
  taskDescription: string;
  fileNames: string[];
  directoryPaths: string[];
  importStatements: string[];
  packageJsonDeps: string[];
  codeSymbols: string[];
  codeBody: string;
  comments: string[];
  stringLiterals: string[];
  agentThoughts: string[];
}

export interface ContextMultipliers {
  taskTitle: number;        // 2.0
  taskDescription: number;  // 1.5
  fileName: number;         // 1.8
  directoryName: number;    // 1.5
  importStatement: number;  // 2.5
  packageJson: number;      // 2.0
  codeSymbol: number;       // 1.5
  codeBody: number;         // 0.8
  comment: number;          // 0.5
  stringLiteral: number;    // 0.3
  agentThought: number;     // 1.8
}

export interface TaxonomyPath {
  axisName: string;
  nodeIds: string[];          // path from root: ['backend', 'backend.database', 'backend.database.postgresql']
  deepestNode: TaxonomyNode;
  confidence: number;
  depth: number;
}

export interface MultiAxisClassification {
  domain: TaxonomyPath | null;
  paradigm: TaxonomyPath | null;
  scale: TaxonomyPath | null;
  concurrency: TaxonomyPath | null;
  lifecycle: TaxonomyPath | null;
  activatedAxes: number;         // count of non-null axes
  overallConfidence: number;     // average confidence across active axes
}

export interface TaxonomyResult {
  classification: MultiAxisClassification;
  resolvedSlots: Map<string, string>;           // slot name → rendered content
  toolOverrides: ToolDescriptionOverride[];     // merged from all active paths
  activeFragmentIds: string[];                  // for tracking/debugging
  classifiedBy: 'heuristic' | 'llm' | 'hybrid';
  skippedReason: string | null;                 // if taxonomy was skipped (complexity gate, low confidence)
}

// === CROSS-AXIS TYPES ===
export interface CrossAxisRule {
  axis1: string;
  axis1Path: string;
  axis2: string;
  axis2Path: string;
  resolution: string;
  intersectionGuidance: string;
}

// === ACTIVATION TYPES ===
export interface ActivationThresholds {
  activationThreshold: number;
  depthThresholds: Record<number, number>;
  siblingAmbiguityBand: number;
  complexityGate: {
    minTitleWords: number;
    minFilesModified: number;
    minPlanSteps: number;
  };
}
