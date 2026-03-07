import type { PeClientOptions } from './types';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(opts: PeClientOptions) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost:3001').replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.timeout = opts.timeout ?? 30_000;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/v1${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });

      const data = await res.json() as T | { error?: string; code?: string };

      if (!res.ok) {
        const e = data as { error?: string; code?: string };
        const err = new PeApiError(e.error ?? `HTTP ${res.status}`, res.status, e.code);
        throw err;
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>('PUT', path, body); }
}

export class PeApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'PeApiError';
  }
}
