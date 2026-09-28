import type { ApiErrorBody, ErrorCode } from '@inovexa/shared'

export const API_BASE = '/api/v1'

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK'

  constructor(status: number, code: ErrorCode | 'NETWORK', message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Query = Record<string, string | number | undefined | null>

export interface RequestOptions {
  query?: Query
  body?: unknown
  form?: FormData
}

export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const url = `${API_BASE}${path}${params.size ? `?${params}` : ''}`
  let response: Response
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    })
  } catch {
    throw new ApiRequestError(0, 'NETWORK', 'Could not reach the server.')
  }
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'NETWORK',
      error?.message ?? response.statusText,
    )
  }
  return data as T
}
