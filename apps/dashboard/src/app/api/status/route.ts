import { NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const VALIDATOR_URL = process.env['VALIDATOR_SERVICE_URL'] ?? 'http://localhost:3010';
const PA_SIMULATOR_URL = process.env['PA_SIMULATOR_SERVICE_URL'] ?? 'http://localhost:3003';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency: string | null;
}

async function checkService(name: string, url: string): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(4000) });
    const latency = Date.now() - start;
    return {
      name,
      status: res.ok ? 'operational' : 'degraded',
      latency: `${latency}ms`,
    };
  } catch {
    return { name, status: 'down', latency: null };
  }
}

export async function GET() {
  const [api, validator, paSimulator] = await Promise.all([
    checkService('API Gateway', API_BASE),
    checkService('Validator', VALIDATOR_URL),
    checkService('PA Simulator', PA_SIMULATOR_URL),
  ]);

  // Dashboard is always operational if this route responds
  const dashboard: ServiceStatus = { name: 'Dashboard', status: 'operational', latency: '—' };

  const services = [api, validator, paSimulator, dashboard];
  const allUp = services.every((s) => s.status === 'operational');
  const anyDown = services.some((s) => s.status === 'down');

  return NextResponse.json({
    overall: anyDown ? 'degraded' : allUp ? 'operational' : 'degraded',
    services,
    checkedAt: new Date().toISOString(),
  });
}
