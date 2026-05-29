import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/workflows/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
