'use server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

export type WorkspacePathState = {
  error?: { code: string; message: string }
  sessionId?: string
}

export async function submitWorkspacePath(
  _prevState: WorkspacePathState,
  formData: FormData
): Promise<WorkspacePathState> {
  const path = formData.get('path') as string

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/workspace_path/api/get_path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  } catch {
    return { error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Make sure the backend is running.' } }
  }

  const data = await response.json()

  if (!response.ok) {
    return { error: { code: data.code, message: data.message } }
  }

  return { sessionId: data.session_id }
}
