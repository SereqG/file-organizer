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
  | 'condition'
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

// Extend this union as action/condition/loop/transform nodes are added
export type WorkflowNode = never;

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
