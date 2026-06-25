import { BACKEND_URL, backendHeaders, getSessionId } from '@/lib/server/session'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  // The session is server-trusted: read it from the httpOnly cookie, never from the client body.
  const sessionId = await getSessionId()
  if (!sessionId) {
    return Response.json(
      { code: 'NO_SESSION', message: 'No sandbox session. Reload the page to start one.' },
      { status: 400 },
    )
  }
  const payload = { ...(body as Record<string, unknown>), session_id: sessionId }

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/folder_explorer/api/explore`, {
      method: 'POST',
      headers: await backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
  } catch {
    return Response.json(
      { code: 'NETWORK_ERROR', message: 'Could not reach the server.' },
      { status: 503 }
    )
  }

  const data = await response.json()
  return Response.json(data, { status: response.status })
}
