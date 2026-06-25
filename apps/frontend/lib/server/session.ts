import { cookies } from 'next/headers'

// Shared by the Next route handlers that proxy to the internal-only backend. The session is
// server-trusted: it is read from the httpOnly cookie set by /api/sandbox/session, never from the
// client body, so a visitor can only ever reach their own sandbox's rows.
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'
const SESSION_COOKIE = 'session_id'
// Proves a backend call arrived through this trusted proxy rather than a direct hit on the
// (internal-only) backend. Empty in local dev, where the backend leaves enforcement off.
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? ''

export async function getSessionId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}

// Headers every backend request should carry: the shared secret, plus the server-trusted session id
// (read from the httpOnly cookie) when one exists. The backend uses the session header to enforce
// ownership on resources addressed by an opaque id (executions, explore jobs).
export async function backendHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-Internal-Secret': INTERNAL_SECRET, ...extra }
  const sessionId = await getSessionId()
  if (sessionId) headers['X-Session-Id'] = sessionId
  return headers
}
