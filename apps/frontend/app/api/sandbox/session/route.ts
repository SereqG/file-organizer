import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'
const SESSION_COOKIE = 'session_id'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 // 1 day; the backend reclaims idle sandboxes sooner.

type SessionData = { session_id: string; sandbox_path: string; tree: unknown }

async function reattach(sessionId: string): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/sandbox/api/session/${sessionId}`)
    return res.ok ? ((await res.json()) as SessionData) : null
  } catch {
    return null
  }
}

async function create(): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/sandbox/api/session`, { method: 'POST' })
    return res.ok ? ((await res.json()) as SessionData) : null
  } catch {
    return null
  }
}

// Provision (or reattach to) the visitor's sandbox and pin it to an httpOnly cookie so a refresh
// keeps the same throwaway workspace instead of leaking a new one.
export async function POST(): Promise<NextResponse> {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value

  const data = (existing ? await reattach(existing) : null) ?? (await create())
  if (data === null) {
    return NextResponse.json(
      { message: 'Could not prepare a sandbox. Make sure the backend is running.' },
      { status: 503 },
    )
  }

  store.set(SESSION_COOKIE, data.session_id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return NextResponse.json({ sessionId: data.session_id, path: data.sandbox_path, tree: data.tree })
}
