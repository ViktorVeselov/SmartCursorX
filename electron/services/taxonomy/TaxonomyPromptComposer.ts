import {
  MultiAxisClassification,
  OperationalContext,
  ClassificationSignals,
  CrossAxisRule,
  ToolDescriptionOverride,
  TaxonomyNode,
  ExpertFragment
} from './types';
import { FragmentRenderer } from './FragmentRenderer';
import { TaxonomyClassifier } from './TaxonomyClassifier';

// Helper to search for a node in the entire taxonomy tree
function findNodeInTree(tree: Record<string, TaxonomyNode>, id: string): TaxonomyNode | null {
  for (const rootNode of Object.values(tree)) {
    const found = TaxonomyClassifier.findNodeInSubtree(rootNode, id);
    if (found) return found;
  }
  return null;
}

export class TaxonomyPromptComposer {
  static readonly SOFT_THRESHOLD = 0.3;

  static readonly META_INSTRUCTION_HEADER = 
    `=== TAXONOMY-DRIVEN DOMAIN AWARENESS ===\n` +
    `The following domain-specific guidance has been activated based on analysis of your task.\n` +
    `These are ADDITIONAL concerns to verify — they do NOT replace direct analysis of the\n` +
    `actual codebase. Always verify guidance against the code before applying.\n` +
    `If existing patterns in the codebase address a concern, follow the existing pattern.\n` +
    `If guidance conflicts with what the code actually does, the code takes precedence.\n` +
    `=== END TAXONOMY HEADER ===\n`;

  static readonly SUPPORTING_GUIDANCE_HEADER = `\n\n### Supporting Cross-Domain Guidance\n`;

  static readonly SUPPRESS_PATTERNS = [
    'distributed caching',
    'horizontal partition',
    'sharding',
    'replica',
    'message queue',
    'load balancer'
  ];

  static resolveSlots(
    classification: MultiAxisClassification,
    context: OperationalContext,
    signals: ClassificationSignals,
    crossAxisRules: CrossAxisRule[] = [],
    taxonomyTree?: Record<string, TaxonomyNode>
  ): { resolvedSlots: Map<string, string>; activeFragmentIds: string[]; matchedRules: CrossAxisRule[] } {
    const resolvedSlots = new Map<string, string>();
    const activeFragmentIds: string[] = [];
    const matchedRules: CrossAxisRule[] = [];

    const activeAxes = [
      { name: 'domain', path: classification.domain, slot: 'domain_guidance' },
      { name: 'paradigm', path: classification.paradigm, slot: 'structural_patterns' },
      { name: 'scale', path: classification.scale, slot: 'scale_awareness' },
      { name: 'concurrency', path: classification.concurrency, slot: 'concurrency_guidance' },
      { name: 'lifecycle', path: classification.lifecycle, slot: 'lifecycle_context' }
    ];

    // Find applicable cross-axis rules
    const activePaths = new Set<string>();
    for (const axis of activeAxes) {
      if (axis.path) {
        for (const nodeId of axis.path.nodeIds) {
          activePaths.add(nodeId);
        }
      }
    }

    for (const rule of crossAxisRules) {
      const match1 = activePaths.has(rule.axis1Path);
      const match2 = activePaths.has(rule.axis2Path);
      if (match1 && match2) {
        matchedRules.push(rule);
      }
    }

    for (const axis of activeAxes) {
      if (!axis.path) {
        resolvedSlots.set(axis.slot, '');
        continue;
      }

      // 1. Hierarchical Accumulation: Collect fragments from all nodes on the path
      const accumulatedFragments: ExpertFragment[] = [];
      const rootNode = taxonomyTree ? taxonomyTree[axis.name] : null;

      if (rootNode && taxonomyTree) {
        for (const nodeId of axis.path.nodeIds) {
          const node = TaxonomyClassifier.findNodeInSubtree(rootNode, nodeId);
          if (node) {
            const frags = node.fragments[context] || [];
            accumulatedFragments.push(...frags);
          }
        }
      } else {
        // Fallback to only deepestNode if taxonomyTree is not available
        accumulatedFragments.push(...(axis.path.deepestNode.fragments[context] || []));
      }

      // 2. Soft-Threshold Cross-Referencing: Check cross-references from the primary fragments
      const crossRefFragments: ExpertFragment[] = [];
      const evaluatedCrossRefs = new Set<string>();

      if (taxonomyTree) {
        for (const frag of accumulatedFragments) {
          if (frag.crossReferences) {
            for (const refId of frag.crossReferences) {
              if (evaluatedCrossRefs.has(refId)) continue;
              evaluatedCrossRefs.add(refId);

              const refNode = findNodeInTree(taxonomyTree, refId);
              if (refNode) {
                // NOTE: Cross-reference score is computed on the leaf node only, not the ancestor path.
                // This is fine as long as cross-references point to leaf nodes directly.
                const score = TaxonomyClassifier.scoreNode(refNode, signals);
                if (score >= TaxonomyPromptComposer.SOFT_THRESHOLD) {
                  const refNodeIds: string[] = [];
                  const parts = refId.split('.');
                  let currentPrefix = '';
                  for (const part of parts) {
                    currentPrefix = currentPrefix ? `${currentPrefix}.${part}` : part;
                    refNodeIds.push(currentPrefix);
                  }

                  for (const nodeId of refNodeIds) {
                    const node = findNodeInTree(taxonomyTree, nodeId);
                    if (node) {
                      const refFrags = node.fragments[context] || [];
                      for (const rf of refFrags) {
                        if (rf.weight === 'awareness' || rf.weight === 'principle') {
                          if (!crossRefFragments.some(existing => existing.id === rf.id)) {
                            crossRefFragments.push(rf);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Filter matched rules specific to this axis to append them
      const axisMatchedRules = matchedRules.filter(
        r => r.axis1Path.startsWith(axis.path!.nodeIds[0]) || r.axis2Path.startsWith(axis.path!.nodeIds[0])
      );

      let slotContent = FragmentRenderer.renderSlotBlock(
        accumulatedFragments,
        axis.name,
        axis.path.nodeIds.join(' -> '),
        signals,
        axisMatchedRules
      );

      // Append cross-referenced supporting fragments if any
      if (crossRefFragments.length > 0) {
        slotContent += TaxonomyPromptComposer.SUPPORTING_GUIDANCE_HEADER;
        slotContent += crossRefFragments.map(rf => {
          activeFragmentIds.push(rf.id);
          return FragmentRenderer.renderFragment(rf, signals);
        }).join('\n\n');
      }

      // Scale gating: if scale is single-user/local-desktop, suppress distributed patterns in other axes
      if (
        classification.scale &&
        (classification.scale.deepestNode.id === 'single-user.local-desktop' ||
          classification.scale.deepestNode.id === 'single-user')
      ) {
        for (const pat of TaxonomyPromptComposer.SUPPRESS_PATTERNS) {
          if (slotContent.toLowerCase().includes(pat)) {
            // Suppress: simple replacement or truncation
            const regex = new RegExp(`.*${pat}.*\\n?`, 'gi');
            slotContent = slotContent.replace(regex, '');
          }
        }
      }

      resolvedSlots.set(axis.slot, slotContent);

      for (const f of accumulatedFragments) {
        activeFragmentIds.push(f.id);
      }
    }

    return { resolvedSlots, activeFragmentIds, matchedRules };
  }

  static composePrompt(baseTemplate: string, slots: Map<string, string>): string {
    let prompt = baseTemplate;

    // Meta Instruction Wrapper
    const metaInstructionSlot = 'meta_instruction';
    const hasActiveTaxonomy = [...slots.values()].some(val => val && val.trim().length > 0);

    const metaInstructionText = hasActiveTaxonomy
      ? TaxonomyPromptComposer.META_INSTRUCTION_HEADER
      : '';

    slots.set(metaInstructionSlot, metaInstructionText);

    // Replace all slot markers in baseTemplate
    const slotRegex = /\{\{slot:([a-zA-Z0-9_]+)\}\}/g;
    prompt = prompt.replace(slotRegex, (_match, slotName) => {
      return slots.get(slotName) || '';
    });

    return prompt;
  }

  static composeToolDescriptions(
    baseTools: any[],
    classification: MultiAxisClassification,
    taxonomyTree?: Record<string, TaxonomyNode>
  ): any[] {
    const activeNodes = [
      classification.domain,
      classification.paradigm,
      classification.scale,
      classification.concurrency,
      classification.lifecycle
    ];

    // Merge overrides
    const overridesMap = new Map<string, ToolDescriptionOverride>();

    // We walk down from root, so deeper nodes will overwrite shallower node's tool overrides
    for (const p of activeNodes) {
      if (p) {
        if (taxonomyTree) {
          for (const nodeId of p.nodeIds) {
            const node = findNodeInTree(taxonomyTree, nodeId);
            if (node && node.toolOverrides) {
              for (const ov of node.toolOverrides) {
                overridesMap.set(ov.toolId, ov);
              }
            }
          }
        } else {
          // Fallback to deepest node if taxonomyTree is not available
          const currentNode = p.deepestNode;
          if (currentNode && currentNode.toolOverrides) {
            for (const ov of currentNode.toolOverrides) {
              overridesMap.set(ov.toolId, ov);
            }
          }
        }
      }
    }

    return baseTools.map(tool => {
      const override = overridesMap.get(tool.name);
      if (override) {
        return {
          ...tool,
          description: override.description
        };
      }
      return tool;
    });
  }
}
