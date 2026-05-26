const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(request: Request) {
  const body = await request.json()

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/folder_explorer/api/explore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
