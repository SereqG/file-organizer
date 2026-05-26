export type SkipReason =
  | 'PERMISSION_DENIED'
  | 'SYMBOLIC_LINK'
  | 'ARCHIVE_NOT_SUPPORTED'
  | 'DEPTH_LIMIT'
  | 'IGNORED_DIRECTORY'
  | 'IO_ERROR'
  | 'UNKNOWN'

export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETE'
  | 'FAILED'

export interface FileTreeNode {
  id: string
  name: string
  path: string
  type: 'file' | 'directory'
  level: number
  extension: string | null
  size: number | null
  skipped: boolean | null
  skipped_reason: SkipReason | null
  children: FileTreeNode[] | null
}

export interface ExploreJobResponse {
  job_id: string
  status: JobStatus
  tree: FileTreeNode | null
  requires_confirmation: boolean
  detected_depth: number | null
  error: string | null
}
