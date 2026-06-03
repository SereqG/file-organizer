import type { ConfigRemap } from '@/lib/types/workflow'

// Which config field of each node type holds a filesystem path (single vs list). Mirrors the
// backend's transfer_helpers maps so a Move's returned remap updates the canvas the same way it
// rewrote not-yet-run nodes during the run. Keyed by string so canvas nodes (incl. 'trigger') pass.
const SINGLE_PATH_FIELD: Record<string, string> = {
  createFolder: 'parentFolderPath',
  renameFolder: 'folderPath',
  renameFile: 'filePath',
  moveFile: 'targetPath',
  moveFolder: 'targetPath',
}

const LIST_PATH_FIELD: Record<string, string> = {
  deleteFolder: 'folderPaths',
  deleteFile: 'filePaths',
  copyFile: 'targetPaths',
  copyFolder: 'targetPaths',
}

function rewritePrefix(value: string, oldPath: string, newPath: string): string {
  if (value === oldPath || value.startsWith(oldPath + '/')) {
    return newPath + value.slice(oldPath.length)
  }
  return value
}

// Returns a new config with any path fields rewritten by the remaps, or the same config if untouched.
export function remapNodeConfig<T>(node: { type: string; config: T }, remaps: ConfigRemap[]): T {
  if (remaps.length === 0) return node.config

  const single = SINGLE_PATH_FIELD[node.type]
  const list = LIST_PATH_FIELD[node.type]
  if (!single && !list) return node.config

  const config = { ...(node.config as Record<string, unknown>) }
  for (const { oldPath, newPath } of remaps) {
    if (single && typeof config[single] === 'string') {
      config[single] = rewritePrefix(config[single] as string, oldPath, newPath)
    }
    if (list && Array.isArray(config[list])) {
      config[list] = (config[list] as string[]).map((p) => rewritePrefix(p, oldPath, newPath))
    }
  }
  return config as T
}
