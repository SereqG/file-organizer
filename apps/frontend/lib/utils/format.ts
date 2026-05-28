const SIZE_UNITS = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }

export function formatBytes(bytes: number): string {
  if (bytes >= SIZE_UNITS.TB) return `${(bytes / SIZE_UNITS.TB).toFixed(2).replace(/\.?0+$/, '')} TB`
  if (bytes >= SIZE_UNITS.GB) return `${(bytes / SIZE_UNITS.GB).toFixed(2).replace(/\.?0+$/, '')} GB`
  if (bytes >= SIZE_UNITS.MB) return `${(bytes / SIZE_UNITS.MB).toFixed(2).replace(/\.?0+$/, '')} MB`
  if (bytes >= SIZE_UNITS.KB) return `${(bytes / SIZE_UNITS.KB).toFixed(2).replace(/\.?0+$/, '')} KB`
  return `${bytes} B`
}
