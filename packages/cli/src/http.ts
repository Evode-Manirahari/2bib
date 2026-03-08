// ── CLI HTTP Client ───────────────────────────────────────────────────────────

export class PeApiError extends Error {
  constructor(
    public statusCode: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'PeApiError';
  }
}

export interface RequestOptions {
  apiKey: string;
  baseUrl: string;
  json?: boolean;
}

export async function peRequest<T>(
  method: string,
  path: string,
  opts: RequestOptions,
  body?: unknown,
): Promise<T> {
  const url = `${opts.baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new PeApiError(res.status, data, `API error ${res.status}: ${url}`);
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
