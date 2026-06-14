export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
  type?: 'code' | 'flow' | 'plan' | 'diff' | 'review';
  originalContent?: string;
  flowId?: number;
  flowData?: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export interface PendingPatch {
  find: string;
  replace: string;
}

export interface PendingFileModification {
  relativePath: string;
  absolutePath: string;
  originalContent: string;
  proposedContent: string;
  patches: PendingPatch[];
  addedLines: number;
  removedLines: number;
}

export interface PendingTaskModifications {
  taskId: number;
  modifications: PendingFileModification[];
  planSnapshot: Record<string, unknown>;
  createdAt: number;
}
