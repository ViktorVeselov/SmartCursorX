export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
  type?: 'code' | 'flow' | 'plan' | 'diff';
  originalContent?: string;
  flowId?: number;
  flowData?: {
    nodes: unknown[];
    edges: unknown[];
  };
}
