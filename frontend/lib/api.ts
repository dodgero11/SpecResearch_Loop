const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** NestJS validation errors come back as JSON like {"message": ["field must be X"]} — pull just the readable text out. */
function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] }
    if (Array.isArray(parsed.message)) return parsed.message.join('; ')
    if (typeof parsed.message === 'string') return parsed.message
  } catch {
    // not JSON — fall through to the raw body
  }
  return body
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new ApiError(`Không kết nối được tới server (${BASE_URL}${path})`, 0)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(`API ${path} lỗi ${res.status}${body ? `: ${extractErrorMessage(body)}` : ''}`, res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined })
}

/** For endpoints that return a binary file (e.g. a generated PDF) instead of JSON. */
export async function apiPostBlob(path: string, body?: unknown): Promise<Blob> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(`Không kết nối được tới server (${BASE_URL}${path})`, 0)
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new ApiError(`API ${path} lỗi ${res.status}${errBody ? `: ${extractErrorMessage(errBody)}` : ''}`, res.status)
  }
  return res.blob()
}

/** Triggers a browser download for in-memory file content (no server round trip needed). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
