import console from 'console';

interface ContextSessionState {
    blueprintHash: number;
    memoriesHash: number;
    symbolHash: number;
    ragHash: number;
}

export class ContextReconciler {
    private static sessionCache = new Map<string, ContextSessionState>();

    private static djb2Hash(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    /**
     * Reconciles context blocks, returning optimized blocks.
     * If a block hasn't changed, it returns an optimized lightweight placeholder.
     */
    static reconcile(
        conversationId: string,
        blocks: {
            blueprint: string;
            memories: string;
            symbols: string;
            rag: string;
        }
    ): {
        blueprint: string;
        memories: string;
        symbols: string;
        rag: string;
    } {
        if (!conversationId) return blocks;

        const currentBlueprintHash = this.djb2Hash(blocks.blueprint);
        const currentMemoriesHash = this.djb2Hash(blocks.memories);
        const currentSymbolHash = this.djb2Hash(blocks.symbols);
        const currentRagHash = this.djb2Hash(blocks.rag);

        const cached = this.sessionCache.get(conversationId);

        const reconciled = {
            blueprint: blocks.blueprint,
            memories: blocks.memories,
            symbols: blocks.symbols,
            rag: blocks.rag
        };

        if (cached) {
            if (cached.blueprintHash === currentBlueprintHash && blocks.blueprint.length > 0) {
                reconciled.blueprint = '\n=== GROUND-TRUTH SYSTEM ARCHITECTURE BLUEPRINT ===\n[Unchanged - Cached Context Skipped]\n=== END BLUEPRINT ===\n';
            }
            if (cached.memoriesHash === currentMemoriesHash && blocks.memories.length > 0) {
                reconciled.memories = '\n=== RETRIEVED ARCHITECTURAL DECISIONS & MEMORIES ===\n[Unchanged - Cached Context Skipped]\n=== END MEMORIES ===\n';
            }
            if (cached.symbolHash === currentSymbolHash && blocks.symbols.length > 0) {
                reconciled.symbols = 'Workspace Code Outline Symbols:\n[Unchanged - Cached Context Skipped]\n';
            }
            if (cached.ragHash === currentRagHash && blocks.rag.length > 0) {
                reconciled.rag = 'Relevant Shared Semantic Memory:\n[Unchanged - Cached Context Skipped]\n';
            }
        }

        // Cache the new hashes
        this.sessionCache.set(conversationId, {
            blueprintHash: currentBlueprintHash,
            memoriesHash: currentMemoriesHash,
            symbolHash: currentSymbolHash,
            ragHash: currentRagHash
        });

        const originalLength = blocks.blueprint.length + blocks.memories.length + blocks.symbols.length + blocks.rag.length;
        const newLength = reconciled.blueprint.length + reconciled.memories.length + reconciled.symbols.length + reconciled.rag.length;
        if (originalLength > newLength) {
            console.log(`[ContextReconciler] Saved ${originalLength - newLength} characters of redundant context for session ${conversationId}`);
        }

        return reconciled;
    }

    /**
     * Clears the context cache for a session (e.g. on new task start or reset)
     */
    static clearSession(conversationId: string): void {
        this.sessionCache.delete(conversationId);
    }
}
