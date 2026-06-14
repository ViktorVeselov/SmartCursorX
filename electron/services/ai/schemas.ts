import { z } from 'zod';

export const PlanStepSchema = z.object({
  order: z.number(),
  action: z.enum(['read', 'analyze', 'modify', 'create', 'delete', 'run_command']),
  target: z.string(),
  rationale: z.string(),
  notes: z.string().optional(),
  agent: z.string().optional(),
});

export const TradeoffSchema = z.object({
  task: z.string(),
  considerations: z.string(),
  decision: z.string(),
});

export const ConsequenceSchema = z.object({
  failureMode: z.string(),
  consequence: z.string(),
  harm: z.string(),
  mitigation: z.string(),
});

export const ClassDependencySchema = z.object({
  name: z.string(),
  type: z.enum(['class', 'module', 'service', 'interface']),
  dependsOn: z.array(z.string()),
  description: z.string(),
});

export const ExecutionPlanSchema = z.object({
  taskId: z.number(),
  steps: z.array(PlanStepSchema),
  expectedOutcome: z.string(),
  filesRead: z.array(z.string()),
  filesToModify: z.array(z.string()),
  verificationCriteria: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  designDoc: z.string().optional(),
  codePlanning: z.string().optional(),
  approved: z.boolean().optional(),
  classDependencies: z.array(ClassDependencySchema).optional(),
  tradeoffs: z.array(TradeoffSchema),
  consequences: z.array(ConsequenceSchema),
  planningTradeoffs: z.array(TradeoffSchema).optional(),
  planningConsequences: z.array(ConsequenceSchema).optional(),
});

export const CodePlanningResultSchema = z.object({
  designDoc: z.string(),
  classDependencies: z.array(ClassDependencySchema).optional(),
  tradeoffs: z.array(TradeoffSchema).optional(),
  consequences: z.array(ConsequenceSchema).optional(),
});

export const VerificationScoreSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type Tradeoff = z.infer<typeof TradeoffSchema>;
export type Consequence = z.infer<typeof ConsequenceSchema>;
export type ClassDependency = z.infer<typeof ClassDependencySchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type CodePlanningResult = z.infer<typeof CodePlanningResultSchema>;
export type VerificationScore = z.infer<typeof VerificationScoreSchema>;
