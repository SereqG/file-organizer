import { cookies } from 'next/headers'

// Shared by the persistence route handlers (saved workflows + run history). The session is
// server-trusted: it is read from the httpOnly cookie set by /api/sandbox/session, never from the
// client body, so a visitor can only ever reach their own sandbox's rows.
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'
const SESSION_COOKIE = 'session_id'

export async function getSessionId(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}
