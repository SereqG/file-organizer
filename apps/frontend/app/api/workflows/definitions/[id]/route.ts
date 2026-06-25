import { NextResponse } from 'next/server'
import { BACKEND_URL, backendHeaders, getSessionId } from '@/lib/server/session'

function noSession(): NextResponse {
  return NextResponse.json(
    { message: 'No sandbox session. Reload the page to start one.', code: 'NO_SESSION' },
    { status: 400 },
  )
}

// Load one saved workflow (its full definition) for the session.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) return noSession()
  const { id } = await params

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/definitions/${id}?session_id=${sessionId}`, {
      headers: await backendHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}

// Overwrite an existing saved workflow.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) return noSession()
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/definitions/${id}`, {
      method: 'PUT',
      headers: await backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...(body as Record<string, unknown>), session_id: sessionId }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}

// Delete a saved workflow.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) return noSession()
  const { id } = await params

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/definitions/${id}?session_id=${sessionId}`, {
      method: 'DELETE',
      headers: await backendHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}
