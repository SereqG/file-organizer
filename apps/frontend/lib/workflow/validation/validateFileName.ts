const FORBIDDEN_CHARS = /[<>:"/\\|?*]/
const RESERVED_WINDOWS = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const MAX_NAME_LENGTH = 30

export function validateFileName(name: string | undefined): string | undefined {
  if (!name) return 'File name is required'
  if (name.length > MAX_NAME_LENGTH) return `File name must be at most ${MAX_NAME_LENGTH} characters`
  if (FORBIDDEN_CHARS.test(name)) return 'File name contains forbidden characters: < > : " / \\ | ? *'
  if (name === '.' || name === '..' || name.startsWith('~/')) return 'File name contains a forbidden token'
  if (name.endsWith(' ') || name.endsWith('.')) return 'File name must not end with a space or dot'
  if (RESERVED_WINDOWS.test(name)) return 'File name is a reserved system name'
  return undefined
}
