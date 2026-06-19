import { NextResponse } from 'next/server'
import { BACKEND_URL, getSessionId } from '@/lib/server/session'

function noSession(): NextResponse {
  return NextResponse.json(
    { message: 'No sandbox session. Reload the page to start one.', code: 'NO_SESSION' },
    { status: 400 },
  )
}

// List the session's saved workflows.
export async function GET(): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) return noSession()

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/definitions?session_id=${sessionId}`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}

// Save a new workflow definition for the session.
export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) return noSession()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(body as Record<string, unknown>), session_id: sessionId }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}
