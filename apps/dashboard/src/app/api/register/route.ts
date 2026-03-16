import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; name?: string; reset?: boolean };
    const endpoint = body.reset ? '/v1/register/reset' : '/v1/register';

    const upstream = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, name: body.name }),
    });

    const data = await upstream.json() as Record<string, unknown>;

    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach API server. Make sure the backend is running.', code: 'GATEWAY_ERROR' },
      { status: 502 },
    );
  }
}
