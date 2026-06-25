import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { BACKEND_URL, backendHeaders } from '@/lib/server/session'

const SESSION_COOKIE = 'session_id'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 1 day; the backend reclaims idle sandboxes sooner.

type SessionData = { session_id: string; sandbox_path: string; tree: unknown }

async function reattach(sessionId: string, headers: Record<string, string>): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/sandbox/api/session/${sessionId}`, { headers })
    return res.ok ? ((await res.json()) as SessionData) : null
  } catch {
    return null
  }
}

async function create(headers: Record<string, string>): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/sandbox/api/session`, { method: 'POST', headers })
    return res.ok ? ((await res.json()) as SessionData) : null
  } catch {
    return null
  }
}

// Provision (or reattach to) the visitor's sandbox and pin it to an httpOnly cookie so a refresh
// keeps the same throwaway workspace instead of leaking a new one.
export async function POST(request: Request): Promise<NextResponse> {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value

  // Forward the real client address so the backend's per-IP rate limit on creation sees the visitor,
  // not this proxy. Trusted because the shared secret authenticates the proxy.
  const forwardedFor = request.headers.get('x-forwarded-for') ?? ''
  const headers = await backendHeaders(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : undefined)

  const data = (existing ? await reattach(existing, headers) : null) ?? (await create(headers))
  if (data === null) {
    return NextResponse.json(
      { message: 'Could not prepare a sandbox. Make sure the backend is running.' },
      { status: 503 },
    )
  }

  store.set(SESSION_COOKIE, data.session_id, {
    httpOnly: true,
    // Only mark Secure when actually served over HTTPS; the plain-HTTP demo would otherwise drop it.
    secure: request.headers.get('x-forwarded-proto') === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  // Nothing sensitive is returned in the body: the session id lives only in the httpOnly cookie
  // (attached to backend calls server-side), and the absolute sandbox path is not disclosed. The
  // client re-reads its workspace via the explore endpoints.
  return NextResponse.json({ ok: true })
}
