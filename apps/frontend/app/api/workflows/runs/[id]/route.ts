import { NextResponse } from 'next/server'
import { BACKEND_URL, getSessionId } from '@/lib/server/session'

// Fetch one past run: its summary and stored execution log.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const sessionId = await getSessionId()
  if (!sessionId) {
    return NextResponse.json(
      { message: 'No sandbox session. Reload the page to start one.', code: 'NO_SESSION' },
      { status: 400 },
    )
  }
  const { id } = await params

  try {
    const res = await fetch(`${BACKEND_URL}/workflows/api/runs/${id}?session_id=${sessionId}`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ message: 'Could not reach the server.' }, { status: 503 })
  }
}
