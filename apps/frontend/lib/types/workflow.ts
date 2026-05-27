export interface WorkflowInputField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
}

export interface WorkflowInputSchema {
  fields: WorkflowInputField[];
}

export type WorkflowNodeType =
  | 'manual_trigger'
  | 'schedule_trigger'
  | 'action'
  | 'if'
  | 'loop'
  | 'transform';

export interface BaseWorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  version: number;
  position?: {
    x: number;
    y: number;
  };
}

export interface BaseTriggerNode extends BaseWorkflowNode {
  category: 'trigger';
}

export interface ManualTriggerNode extends BaseTriggerNode {
  type: 'manual_trigger';
  config: {
    inputSchema?: WorkflowInputSchema;
  };
}

export interface ScheduleTriggerNode extends BaseTriggerNode {
  type: 'schedule_trigger';
  config: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
}

export type WorkflowTriggerNode = ManualTriggerNode | ScheduleTriggerNode;

export interface BaseGeneralNode extends BaseWorkflowNode {
  category: 'general';
}

export type LogicalOperator = 'AND' | 'OR';

export type MissingFieldStrategy = 'false' | 'error' | 'skip';

export type ItemType = 'file' | 'folder' | 'symlink';

export type ConditionOperator =
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'between'
  | 'before'
  | 'after'
  | 'within_last';

export const MAX_GROUP_DEPTH = 10;

export interface ConditionOptions {
  caseSensitive?: boolean;
}

export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: unknown;
  negate?: boolean;
  options?: ConditionOptions;
}

export interface ConditionGroup {
  id: string;
  operator: LogicalOperator;
  negate?: boolean;
  children: Array<Condition | ConditionGroup>;
}

export function isConditionGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return 'children' in node;
}

export interface IfNode extends BaseGeneralNode {
  type: 'if';
  config: {
    conditions: ConditionGroup;
    missingFieldStrategy?: MissingFieldStrategy;
  };
  outputs: {
    true: string;
    false: string;
  };
}

export type WorkflowNode = IfNode;

export interface WorkflowItemStat {
  size: number;
  createdAt: string;
  modifiedAt: string;
  accessedAt: string;
}

export interface WorkflowItemFlags {
  hidden: boolean;
  executable: boolean;
  readable: boolean;
  writable: boolean;
}

export interface EvaluationFailure {
  condition: string;
  expected: unknown;
  actual: unknown;
}

export interface EvaluationResult {
  matched: boolean;
  matchedConditions: string[];
  failedConditions: EvaluationFailure[];
}

export interface WorkflowItem {
  id: string;
  path: string;
  name: string;
  type: ItemType;
  extension?: string;
  mimeType?: string;
  stat: WorkflowItemStat;
  flags: WorkflowItemFlags;
  children?: WorkflowItem[];
  ai?: Record<string, unknown>;
  workflow?: {
    evaluation?: EvaluationResult;
  };
}

export interface WorkflowEdge {
  id: string;
  source: 'trigger' | string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  version: string;
  trigger: WorkflowTriggerNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
