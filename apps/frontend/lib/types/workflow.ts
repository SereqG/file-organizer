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
  | 'switch'
  | 'createFolder'
  | 'deleteFolder'
  | 'renameFolder'
  | 'deleteFile'
  | 'renameFile'
  | 'moveFile'
  | 'moveFolder'
  | 'copyFile'
  | 'copyFolder'
  | 'ai_classifier'
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
}

// Output handle id for the switch node's always-present "everything else" branch. Distinct from
// any case id (case ids come from nextId('case')), and mirrored by the backend BRANCH_DEFAULT.
export const SWITCH_DEFAULT_HANDLE = 'default';

// Output handle id for the AI classifier's always-present unclassified branch.
export const AI_CLASSIFIER_UNCLASSIFIED_HANDLE = '_unclassified';
export const MIN_SWITCH_CASES = 2;
export const MAX_SWITCH_CASES = 8;

export interface SwitchCase {
  id: string;
  conditions: ConditionGroup;
}

export interface SwitchNode extends BaseGeneralNode {
  type: 'switch';
  config: {
    cases: SwitchCase[];
    missingFieldStrategy?: MissingFieldStrategy;
  };
}

export type IfExists = 'reuse_existing' | 'rename_incrementally' | 'overwrite' | 'fail'

export interface CreateFolderNode extends BaseGeneralNode {
  type: 'createFolder';
  config: {
    folderName: string;
    parentFolderPath: string;
    ifExists: IfExists;
  };
}

export interface DeleteFolderNode extends BaseGeneralNode {
  type: 'deleteFolder';
  config: {
    deleteAllEncountered: boolean;
    folderPaths: string[];
  };
}

export type RenameIfExists = 'fail' | 'rename_incrementally';

export interface RenameFolderNode extends BaseGeneralNode {
  type: 'renameFolder';
  config: {
    folderPath: string;
    newName: string;
    ifExists: RenameIfExists;
  };
}

export interface DeleteFileNode extends BaseGeneralNode {
  type: 'deleteFile';
  config: {
    deleteAllEncountered: boolean;
    filePaths: string[];
  };
}

export interface RenameFileNode extends BaseGeneralNode {
  type: 'renameFile';
  config: {
    filePath: string;
    newName: string;
    ifExists: RenameIfExists;
  };
}

// Collision strategy for the transfer (Move/Copy) nodes. `skip` is unique to transfers.
export type TransferIfExists = 'fail' | 'rename_incrementally' | 'overwrite' | 'skip';

export interface MoveFileNode extends BaseGeneralNode {
  type: 'moveFile';
  config: {
    targetPath: string;
    ifExists: TransferIfExists;
  };
}

export interface MoveFolderNode extends BaseGeneralNode {
  type: 'moveFolder';
  config: {
    targetPath: string;
    ifExists: TransferIfExists;
  };
}

export interface CopyFileNode extends BaseGeneralNode {
  type: 'copyFile';
  config: {
    targetPaths: string[];
    keepOriginal: boolean;
    ifExists: TransferIfExists;
  };
}

export interface CopyFolderNode extends BaseGeneralNode {
  type: 'copyFolder';
  config: {
    targetPaths: string[];
    keepOriginal: boolean;
    ifExists: TransferIfExists;
  };
}

export interface AiClassifierNode extends BaseGeneralNode {
  type: 'ai_classifier';
  config: {
    categoryIds: string[];
    allowDuplicate: boolean;
  };
}

export type WorkflowNode = IfNode | SwitchNode | CreateFolderNode | DeleteFolderNode | RenameFolderNode | DeleteFileNode | RenameFileNode | MoveFileNode | MoveFolderNode | CopyFileNode | CopyFolderNode | AiClassifierNode;

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

export interface ExecutionFailedNode {
  id: string;
  error: string;
}

// Non-fatal notice raised by a node (e.g. Move/Copy auto-skipped an item). `code` is a stable
// machine code from the backend warning catalogue; the popup groups warnings by it.
export interface ExecutionWarning {
  nodeId: string;
  code: string;
  message: string;
  itemPath?: string | null;
  targetPath?: string | null;
}

// A path relocation a Move performed; the editor applies these to node configs so the canvas updates.
export interface ConfigRemap {
  oldPath: string;
  newPath: string;
}

export interface ExecutionResult {
  success: boolean;
  error?: string;
  failedNodes: ExecutionFailedNode[];
  warnings: ExecutionWarning[];
  configRemap: ConfigRemap[];
}

// One filesystem operation a dry-run predicts. `kind` is create | delete | rename | reuse | move | copy | skip.
export interface PlannedAction {
  nodeId: string;
  kind: string;
  description: string;
  itemPath?: string | null;
  targetPath?: string | null;
}

// Result of a dry-run: what a real run would do, surfaced in the preview gate before any disk writes.
export interface WorkflowPreview {
  ok: boolean;
  error?: string | null;
  actions: PlannedAction[];
  warnings: ExecutionWarning[];
  failedNodes: ExecutionFailedNode[];
}

export type LogEntryKind = 'moved' | 'copied' | 'created' | 'deleted' | 'renamed' | 'skipped' | 'warning' | 'started' | 'classified' | 'unclassified';

export interface LogEntry {
  nodeId: string;
  nodeName: string;
  kind: LogEntryKind;
  itemName: string;
  message: string | null;
  elapsed: number; // seconds since execution start
}

// A mid-run choice the engine is blocked on (e.g. a Move/Copy destination-name collision). The user
// picks one of `options`; the choice is posted back to resume the suspended run.
export interface PendingDecision {
  nodeId: string;
  code?: string;
  message?: string;
  itemPath?: string | null;
  targetPath?: string | null;
  options?: string[];
  default?: string;
}
