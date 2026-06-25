import { BACKEND_URL, backendHeaders } from '@/lib/server/session'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/folder_explorer/api/explore/${jobId}`, {
      headers: await backendHeaders(),
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
