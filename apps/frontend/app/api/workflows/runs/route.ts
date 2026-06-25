import { NextResponse } from 'next/server'
import { BACKEND_URL, backendHeaders, getSessionId } from '@/lib/server/session'

// List the session's run history.
export async function GET(): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) {
    return NextResponse.json(
      { message: 'No sandbox session. Reload the page to start one.', code: 'NO_SESSION' },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/runs?session_id=${sessionId}`, {
      headers: await backendHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}
