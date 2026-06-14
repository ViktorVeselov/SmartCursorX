import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dbService } from '../../db';
import {
  TaxonomyNode,
  TaxonomyResult,
  MultiAxisClassification,
  CrossAxisRule,
  OperationalContext,
  TaxonomyPath
} from './types';
import { TaxonomyClassifier } from './TaxonomyClassifier';
import { TaxonomyPromptComposer } from './TaxonomyPromptComposer';

export class TaxonomyService {
  private static instance: TaxonomyService | null = null;

  private taxonomyTree: Record<string, TaxonomyNode> = {};
  private crossAxisRules: CrossAxisRule[] = [];
  private wordIndex = new Map<string, Set<string>>(); // word -> set of nodeIds
  private phraseIndex: Array<{ phrase: string; nodeId: string }> = [];
  private isInitialized = false;

  private constructor() {}

  static getInstance(): TaxonomyService {
    if (!this.instance) {
      this.instance = new TaxonomyService();
    }
    return this.instance;
  }

  initialize(): void {
    if (this.isInitialized) return;

    try {
      const servicesDir = typeof __filename !== 'undefined'
        ? path.dirname(__filename)
        : path.dirname(fileURLToPath(import.meta.url));
      const treePath = path.join(servicesDir, 'taxonomyTree.json');
      const rulesPath = path.join(servicesDir, 'crossAxisRules.json');

      if (!fs.existsSync(treePath)) {
        throw new Error(`Taxonomy tree JSON file not found at ${treePath}`);
      }
      if (!fs.existsSync(rulesPath)) {
        throw new Error(`Cross-axis rules JSON file not found at ${rulesPath}`);
      }

      this.taxonomyTree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
      const rulesJson = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      this.crossAxisRules = rulesJson.rules || [];

      // Build indices
      this.buildIndices();

      // Validate integrity
      this.validateTreeIntegrity();

      this.isInitialized = true;
      console.log('[TaxonomyService] Successfully initialized taxonomy engine.');
    } catch (e) {
      console.error('[TaxonomyService] Initialization failed:', e);
      throw e;
    }
  }

  private buildIndices(): void {
    this.wordIndex.clear();
    this.phraseIndex = [];

    const walk = (node: TaxonomyNode) => {
      if (node.triggers) {
        if (node.triggers.words) {
          for (const w of node.triggers.words) {
            const wordLower = w.word.toLowerCase();
            if (!this.wordIndex.has(wordLower)) {
              this.wordIndex.set(wordLower, new Set());
            }
            this.wordIndex.get(wordLower)!.add(node.id);
          }
        }
        if (node.triggers.phrases) {
          for (const p of node.triggers.phrases) {
            this.phraseIndex.push({ phrase: p.phrase.toLowerCase(), nodeId: node.id });
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          walk(child);
        }
      }
    };

    for (const axisTree of Object.values(this.taxonomyTree)) {
      walk(axisTree);
    }

    // Sort phrases by length descending for greedy phrase matching
    this.phraseIndex.sort((a, b) => b.phrase.length - a.phrase.length);
  }

  private validateTreeIntegrity(): void {
    const nodeIds = new Set<string>();

    const checkNode = (node: TaxonomyNode) => {
      if (!node.id) {
        throw new Error('Taxonomy node missing unique ID');
      }
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate taxonomy node ID found: ${node.id}`);
      }
      nodeIds.add(node.id);

      if (node.children) {
        for (const child of node.children) {
          checkNode(child);
        }
      }
    };

    for (const [axisName, axisTree] of Object.entries(this.taxonomyTree)) {
      if (axisTree.id !== axisName) {
        throw new Error(`Axis root node ID '${axisTree.id}' must match key '${axisName}'`);
      }
      checkNode(axisTree);
    }
  }

  classify(
    task: any,
    context: OperationalContext,
    plan?: any,
    investigationResults?: string,
    fileContentsMap?: Record<string, string>,
    packageJsonDeps: string[] = []
  ): TaxonomyResult {
    this.initialize();

    if (!TaxonomyClassifier.shouldActivateTaxonomy(task, plan)) {
      return {
        classification: {
          domain: null,
          paradigm: null,
          scale: null,
          concurrency: null,
          lifecycle: null,
          activatedAxes: 0,
          overallConfidence: 0.0
        },
        resolvedSlots: new Map(),
        toolOverrides: [],
        activeFragmentIds: [],
        classifiedBy: 'heuristic',
        skippedReason: 'complexity gate'
      };
    }

    const signals = TaxonomyClassifier.gatherSignals(
      task,
      plan,
      investigationResults,
      fileContentsMap,
      packageJsonDeps
    );

    const classification: MultiAxisClassification = {
      domain: null,
      paradigm: null,
      scale: null,
      concurrency: null,
      lifecycle: null,
      activatedAxes: 0,
      overallConfidence: 0.0
    };

    const axesKeys = ['domain', 'paradigm', 'scale', 'concurrency', 'lifecycle'] as const;
    let totalConfidence = 0.0;
    let activeCount = 0;

    for (const key of axesKeys) {
      const rootNode = this.taxonomyTree[key];
      if (rootNode) {
        const path = TaxonomyClassifier.classifyAxis(key, rootNode, signals);
        if (path) {
          classification[key] = path;
          totalConfidence += path.confidence;
          activeCount++;
        }
      }
    }

    classification.activatedAxes = activeCount;
    classification.overallConfidence = activeCount > 0 ? totalConfidence / activeCount : 0.0;

    const { resolvedSlots, activeFragmentIds } = TaxonomyPromptComposer.resolveSlots(
       classification,
       context,
       signals,
       this.crossAxisRules,
       this.taxonomyTree
    );

    // Merge tool overrides from active paths
    const toolOverrides: any[] = [];
    const collectOverrides = (path: TaxonomyPath) => {
      // Walk down the resolved path nodes from root to leaf
      for (const nodeId of path.nodeIds) {
        const node = TaxonomyClassifier.findNodeInSubtree(rootNodeForPath(path.axisName), nodeId);
        if (node && node.toolOverrides) {
          toolOverrides.push(...node.toolOverrides);
        }
      }
    };

    const rootNodeForPath = (axisName: string): TaxonomyNode => this.taxonomyTree[axisName];

    for (const key of axesKeys) {
      const path = classification[key];
      if (path) {
        collectOverrides(path);
      }
    }

    // Deduplicate overrides by toolId (deeper overrides win, which we collect last or sort)
    const uniqueOverridesMap = new Map<string, any>();
    for (const ov of toolOverrides) {
      uniqueOverridesMap.set(ov.toolId, ov);
    }

    return {
      classification,
      resolvedSlots,
      toolOverrides: [...uniqueOverridesMap.values()],
      activeFragmentIds,
      classifiedBy: 'heuristic',
      skippedReason: null
    };
  }

  reclassify(
    _previousResult: TaxonomyResult,
    task: any,
    context: OperationalContext,
    plan?: any,
    newInvestigationResults?: string,
    fileContentsMap?: Record<string, string>,
    packageJsonDeps: string[] = []
  ): TaxonomyResult {
    // Merge new signals and re-run classification
    return this.classify(task, context, plan, newInvestigationResults, fileContentsMap, packageJsonDeps);
  }

  trackResult(taskId: number, result: TaxonomyResult, phase: string): void {
    if (!result || result.skippedReason) return;

    try {
      const db = (dbService as any).db;
      if (!db) {
        console.warn('[TaxonomyService] Database connection not available for tracking.');
        return;
      }

      // Check if task_taxonomy_tracking table exists, create it dynamically if not (double safety)
      db.prepare(`
        CREATE TABLE IF NOT EXISTS task_taxonomy_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          axis TEXT NOT NULL,
          resolved_path TEXT NOT NULL,
          confidence REAL NOT NULL,
          classified_by TEXT NOT NULL,
          classification_depth INTEGER NOT NULL,
          fragments_injected INTEGER NOT NULL,
          phase TEXT NOT NULL,
          reclassified INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();

      const stmt = db.prepare(`
        INSERT INTO task_taxonomy_tracking (
          task_id, axis, resolved_path, confidence, classified_by, classification_depth, fragments_injected, phase
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const axesKeys = ['domain', 'paradigm', 'scale', 'concurrency', 'lifecycle'] as const;
      for (const key of axesKeys) {
        const path = result.classification[key];
        if (path) {
          const depth = path.depth;
          const fragmentsCount = result.activeFragmentIds.length; // Approximate total or filter by axis prefix
          stmt.run(
            taskId,
            key,
            path.nodeIds.join('.'),
            path.confidence,
            result.classifiedBy,
            depth,
            fragmentsCount,
            phase
          );
        }
      }
    } catch (e) {
      console.error('[TaxonomyService] Failed to track result in database:', e);
    }
  }
}

export const taxonomyService = TaxonomyService.getInstance();
