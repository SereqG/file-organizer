import { BACKEND_URL, backendHeaders } from '@/lib/server/session'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params

  let backendRes: Response
  try {
    backendRes = await fetch(`${BACKEND_URL}/workflows/api/execute/${executionId}/logs`, {
      cache: 'no-store',
      headers: await backendHeaders(),
    })
  } catch {
    return new Response('Backend unavailable', { status: 503 })
  }

  if (!backendRes.ok || !backendRes.body) {
    return new Response('Not found', { status: backendRes.status })
  }

  return new Response(backendRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
