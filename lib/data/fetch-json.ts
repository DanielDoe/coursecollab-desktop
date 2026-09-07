export class QueryFetchError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "QueryFetchError"
    this.status = status
  }
}

export async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new QueryFetchError(
      typeof data?.error === "string" ? data.error : `Request failed (${res.status})`,
      res.status,
    )
  }
  return data
}
