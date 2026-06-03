const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/workflows/api/execute/${executionId}`)
  } catch {
    return Response.json({ error: 'Could not reach the server.' }, { status: 503 })
  }

  const data = await response.json().catch(() => ({}))
  return Response.json(data, { status: response.status })
}
