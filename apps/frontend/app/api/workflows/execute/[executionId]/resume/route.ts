import { BACKEND_URL, backendHeaders } from '@/lib/server/session'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/workflows/api/execute/${executionId}/resume`, {
      method: 'POST',
      headers: await backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
  } catch {
    return Response.json({ error: 'Could not reach the server.' }, { status: 503 })
  }

  const data = await response.json().catch(() => ({}))
  return Response.json(data, { status: response.status })
}
