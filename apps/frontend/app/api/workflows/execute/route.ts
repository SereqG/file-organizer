import { NextResponse } from 'next/server'
import { BACKEND_URL, backendHeaders, getSessionId } from '@/lib/server/session'

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  // The session is server-trusted: read it from the httpOnly cookie, never from the client body.
  const sessionId = await getSessionId()
  if (!sessionId) {
    return NextResponse.json(
      { message: 'No sandbox session. Reload the page to start one.', code: 'NO_SESSION' },
      { status: 400 },
    )
  }

  const payload = { ...(body as Record<string, unknown>), session_id: sessionId }

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/workflows/api/execute`, {
      method: 'POST',
      headers: await backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json(
      { message: 'Could not reach the server. Make sure the backend is running.' },
      { status: 503 }
    )
  }

  const data = await response.json().catch(() => ({}))

  return NextResponse.json(data, { status: response.status })
}
