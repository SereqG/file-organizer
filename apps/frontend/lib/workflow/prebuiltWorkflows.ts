import type { WorkflowDefinition } from '@/lib/types/workflow'

export interface PrebuiltWorkflow {
  id: string
  name: string
  description: string
  nodeCount: number
  requiresApiKey: boolean
  templateVariant: string
  definition: WorkflowDefinition
}

// Paths use {{workspace}} as a placeholder replaced with the actual sandbox path before loading.

const downloadsSorter: PrebuiltWorkflow = {
  id: 'downloads_sorter',
  name: 'Downloads Sorter',
  description: 'Sorts a cluttered folder by extension — images, documents, videos, and archives each go to their own subfolder.',
  nodeCount: 9,
  requiresApiKey: false,
  templateVariant: 'downloads_sorter',
  definition: {
    version: '1.0',
    trigger: {
      id: 'trigger-ds',
      type: 'manual_trigger',
      category: 'trigger',
      name: 'Manual Trigger',
      version: 1,
      config: {},
      position: { x: 300, y: 40 },
    },
    nodes: [
      {
        id: 'if-images',
        type: 'if',
        category: 'general',
        name: 'Is Image?',
        version: 1,
        config: {
          conditions: {
            id: 'if-images-root',
            operator: 'OR',
            children: [
              { id: 'img-c1', field: 'extension', operator: 'equals', value: '.jpg' },
              { id: 'img-c2', field: 'extension', operator: 'equals', value: '.jpeg' },
              { id: 'img-c3', field: 'extension', operator: 'equals', value: '.png' },
              { id: 'img-c4', field: 'extension', operator: 'equals', value: '.gif' },
              { id: 'img-c5', field: 'extension', operator: 'equals', value: '.webp' },
            ],
          },
        },
        position: { x: 300, y: 160 },
      },
      {
        id: 'move-images',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Images',
        version: 1,
        config: { targetPath: '{{workspace}}/Downloads/Images', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 300 },
      },
      {
        id: 'if-docs',
        type: 'if',
        category: 'general',
        name: 'Is Document?',
        version: 1,
        config: {
          conditions: {
            id: 'if-docs-root',
            operator: 'OR',
            children: [
              { id: 'doc-c1', field: 'extension', operator: 'equals', value: '.pdf' },
              { id: 'doc-c2', field: 'extension', operator: 'equals', value: '.doc' },
              { id: 'doc-c3', field: 'extension', operator: 'equals', value: '.docx' },
              { id: 'doc-c4', field: 'extension', operator: 'equals', value: '.txt' },
              { id: 'doc-c5', field: 'extension', operator: 'equals', value: '.md' },
            ],
          },
        },
        position: { x: 300, y: 300 },
      },
      {
        id: 'move-docs',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Documents',
        version: 1,
        config: { targetPath: '{{workspace}}/Downloads/Documents', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 440 },
      },
      {
        id: 'if-videos',
        type: 'if',
        category: 'general',
        name: 'Is Video?',
        version: 1,
        config: {
          conditions: {
            id: 'if-videos-root',
            operator: 'OR',
            children: [
              { id: 'vid-c1', field: 'extension', operator: 'equals', value: '.mp4' },
              { id: 'vid-c2', field: 'extension', operator: 'equals', value: '.mkv' },
              { id: 'vid-c3', field: 'extension', operator: 'equals', value: '.avi' },
              { id: 'vid-c4', field: 'extension', operator: 'equals', value: '.mov' },
            ],
          },
        },
        position: { x: 300, y: 440 },
      },
      {
        id: 'move-videos',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Videos',
        version: 1,
        config: { targetPath: '{{workspace}}/Downloads/Videos', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 580 },
      },
      {
        id: 'if-archives',
        type: 'if',
        category: 'general',
        name: 'Is Archive?',
        version: 1,
        config: {
          conditions: {
            id: 'if-archives-root',
            operator: 'OR',
            children: [
              { id: 'arc-c1', field: 'extension', operator: 'equals', value: '.zip' },
              { id: 'arc-c2', field: 'extension', operator: 'equals', value: '.rar' },
              { id: 'arc-c3', field: 'extension', operator: 'equals', value: '.tar' },
              { id: 'arc-c4', field: 'extension', operator: 'equals', value: '.gz' },
              { id: 'arc-c5', field: 'extension', operator: 'equals', value: '.7z' },
            ],
          },
        },
        position: { x: 300, y: 580 },
      },
      {
        id: 'move-archives',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Archives',
        version: 1,
        config: { targetPath: '{{workspace}}/Downloads/Archives', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 720 },
      },
    ],
    edges: [
      { id: 'trigger-ds-default->if-images', source: 'trigger-ds', target: 'if-images' },
      { id: 'if-images-true->move-images', source: 'if-images', target: 'move-images', sourceHandle: 'true' },
      { id: 'if-images-false->if-docs', source: 'if-images', target: 'if-docs', sourceHandle: 'false' },
      { id: 'if-docs-true->move-docs', source: 'if-docs', target: 'move-docs', sourceHandle: 'true' },
      { id: 'if-docs-false->if-videos', source: 'if-docs', target: 'if-videos', sourceHandle: 'false' },
      { id: 'if-videos-true->move-videos', source: 'if-videos', target: 'move-videos', sourceHandle: 'true' },
      { id: 'if-videos-false->if-archives', source: 'if-videos', target: 'if-archives', sourceHandle: 'false' },
      { id: 'if-archives-true->move-archives', source: 'if-archives', target: 'move-archives', sourceHandle: 'true' },
    ],
  },
}

const documentClassifier: PrebuiltWorkflow = {
  id: 'document_classifier',
  name: 'Document Classifier',
  description: 'Uses AI to read document content and routes invoices, contracts, and reports into separate folders automatically.',
  nodeCount: 8,
  requiresApiKey: true,
  templateVariant: 'document_classifier',
  definition: {
    version: '1.0',
    trigger: {
      id: 'trigger-dc',
      type: 'manual_trigger',
      category: 'trigger',
      name: 'Manual Trigger',
      version: 1,
      config: {},
      position: { x: 300, y: 40 },
    },
    nodes: [
      {
        id: 'create-invoices',
        type: 'createFolder',
        category: 'general',
        name: 'Create Invoices folder',
        version: 1,
        config: { folderName: 'Invoices', parentFolderPath: '{{workspace}}', ifExists: 'reuse_existing' },
        position: { x: 300, y: 160 },
      },
      {
        id: 'create-contracts',
        type: 'createFolder',
        category: 'general',
        name: 'Create Contracts folder',
        version: 1,
        config: { folderName: 'Contracts', parentFolderPath: '{{workspace}}', ifExists: 'reuse_existing' },
        position: { x: 300, y: 280 },
      },
      {
        id: 'create-reports',
        type: 'createFolder',
        category: 'general',
        name: 'Create Reports folder',
        version: 1,
        config: { folderName: 'Reports', parentFolderPath: '{{workspace}}', ifExists: 'reuse_existing' },
        position: { x: 300, y: 400 },
      },
      {
        id: 'ai-classifier',
        type: 'ai_classifier',
        category: 'general',
        name: 'Classify Document',
        version: 1,
        config: { categoryIds: ['predefined:invoices', 'predefined:documents', 'predefined:spreadsheets'], allowDuplicate: false },
        position: { x: 300, y: 520 },
      },
      {
        id: 'move-to-invoices',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Invoices',
        version: 1,
        config: { targetPath: '{{workspace}}/Invoices', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 680 },
      },
      {
        id: 'move-to-contracts',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Contracts',
        version: 1,
        config: { targetPath: '{{workspace}}/Contracts', ifExists: 'rename_incrementally' },
        position: { x: 300, y: 680 },
      },
      {
        id: 'move-to-reports',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Reports',
        version: 1,
        config: { targetPath: '{{workspace}}/Reports', ifExists: 'rename_incrementally' },
        position: { x: 540, y: 680 },
      },
    ],
    edges: [
      { id: 'trigger-dc-default->create-invoices', source: 'trigger-dc', target: 'create-invoices' },
      { id: 'create-invoices-default->create-contracts', source: 'create-invoices', target: 'create-contracts' },
      { id: 'create-contracts-default->create-reports', source: 'create-contracts', target: 'create-reports' },
      { id: 'create-reports-default->ai-classifier', source: 'create-reports', target: 'ai-classifier' },
      { id: 'ai-classifier-predefined:invoices->move-to-invoices', source: 'ai-classifier', target: 'move-to-invoices', sourceHandle: 'predefined:invoices' },
      { id: 'ai-classifier-predefined:documents->move-to-contracts', source: 'ai-classifier', target: 'move-to-contracts', sourceHandle: 'predefined:documents' },
      { id: 'ai-classifier-predefined:spreadsheets->move-to-reports', source: 'ai-classifier', target: 'move-to-reports', sourceHandle: 'predefined:spreadsheets' },
    ],
  },
}

const codeOrganizer: PrebuiltWorkflow = {
  id: 'code_organizer',
  name: 'Code Project Organizer',
  description: 'Tidies a mixed project folder: source files go to Source/, docs to Docs/, configs to Config/, and log files are deleted.',
  nodeCount: 9,
  requiresApiKey: false,
  templateVariant: 'code_organizer',
  definition: {
    version: '1.0',
    trigger: {
      id: 'trigger-co',
      type: 'manual_trigger',
      category: 'trigger',
      name: 'Manual Trigger',
      version: 1,
      config: {},
      position: { x: 300, y: 40 },
    },
    nodes: [
      {
        id: 'if-code',
        type: 'if',
        category: 'general',
        name: 'Is Source Code?',
        version: 1,
        config: {
          conditions: {
            id: 'if-code-root',
            operator: 'OR',
            children: [
              { id: 'code-c1', field: 'extension', operator: 'equals', value: '.py' },
              { id: 'code-c2', field: 'extension', operator: 'equals', value: '.ts' },
              { id: 'code-c3', field: 'extension', operator: 'equals', value: '.tsx' },
              { id: 'code-c4', field: 'extension', operator: 'equals', value: '.js' },
              { id: 'code-c5', field: 'extension', operator: 'equals', value: '.jsx' },
            ],
          },
        },
        position: { x: 300, y: 160 },
      },
      {
        id: 'move-source',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Source',
        version: 1,
        config: { targetPath: '{{workspace}}/Project/Source', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 300 },
      },
      {
        id: 'if-docs',
        type: 'if',
        category: 'general',
        name: 'Is Documentation?',
        version: 1,
        config: {
          conditions: {
            id: 'if-docs-root',
            operator: 'OR',
            children: [
              { id: 'co-doc-c1', field: 'extension', operator: 'equals', value: '.md' },
              { id: 'co-doc-c2', field: 'extension', operator: 'equals', value: '.rst' },
              { id: 'co-doc-c3', field: 'extension', operator: 'equals', value: '.txt' },
            ],
          },
        },
        position: { x: 300, y: 300 },
      },
      {
        id: 'move-docs',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Docs',
        version: 1,
        config: { targetPath: '{{workspace}}/Project/Docs', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 440 },
      },
      {
        id: 'if-config',
        type: 'if',
        category: 'general',
        name: 'Is Config?',
        version: 1,
        config: {
          conditions: {
            id: 'if-config-root',
            operator: 'OR',
            children: [
              { id: 'cfg-c1', field: 'extension', operator: 'equals', value: '.json' },
              { id: 'cfg-c2', field: 'extension', operator: 'equals', value: '.yml' },
              { id: 'cfg-c3', field: 'extension', operator: 'equals', value: '.yaml' },
              { id: 'cfg-c4', field: 'extension', operator: 'equals', value: '.toml' },
            ],
          },
        },
        position: { x: 300, y: 440 },
      },
      {
        id: 'move-config',
        type: 'moveFile',
        category: 'general',
        name: 'Move to Config',
        version: 1,
        config: { targetPath: '{{workspace}}/Project/Config', ifExists: 'rename_incrementally' },
        position: { x: 60, y: 580 },
      },
      {
        id: 'if-logs',
        type: 'if',
        category: 'general',
        name: 'Is Log File?',
        version: 1,
        config: {
          conditions: {
            id: 'if-logs-root',
            operator: 'OR',
            children: [
              { id: 'log-c1', field: 'extension', operator: 'equals', value: '.log' },
            ],
          },
        },
        position: { x: 300, y: 580 },
      },
      {
        id: 'delete-logs',
        type: 'deleteFile',
        category: 'general',
        name: 'Delete Log',
        version: 1,
        config: { deleteAllEncountered: false, filePaths: [] },
        position: { x: 60, y: 720 },
      },
    ],
    edges: [
      { id: 'trigger-co-default->if-code', source: 'trigger-co', target: 'if-code' },
      { id: 'if-code-true->move-source', source: 'if-code', target: 'move-source', sourceHandle: 'true' },
      { id: 'if-code-false->if-docs', source: 'if-code', target: 'if-docs', sourceHandle: 'false' },
      { id: 'if-docs-true->move-docs', source: 'if-docs', target: 'move-docs', sourceHandle: 'true' },
      { id: 'if-docs-false->if-config', source: 'if-docs', target: 'if-config', sourceHandle: 'false' },
      { id: 'if-config-true->move-config', source: 'if-config', target: 'move-config', sourceHandle: 'true' },
      { id: 'if-config-false->if-logs', source: 'if-config', target: 'if-logs', sourceHandle: 'false' },
      { id: 'if-logs-true->delete-logs', source: 'if-logs', target: 'delete-logs', sourceHandle: 'true' },
    ],
  },
}

export const PREBUILT_WORKFLOWS: PrebuiltWorkflow[] = [downloadsSorter, documentClassifier, codeOrganizer]
