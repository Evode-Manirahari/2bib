'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency: string | null;
}

interface StatusResponse {
  overall: 'operational' | 'degraded';
  services: ServiceStatus[];
  checkedAt: string;
}

const STATUS_COLOR = {
  operational: '#00ff94',
  degraded: '#fbbf24',
  down: '#ef4444',
} as const;

const STATUS_LABEL = {
  operational: 'operational',
  degraded: 'degraded',
  down: 'down',
} as const;

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      const json = await res.json() as StatusResponse;
      setData(json);
    } catch {
      // network error — leave stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const overall = data?.overall ?? 'operational';
  const allOk = overall === 'operational';
  const checkedAt = data?.checkedAt
    ? new Date(data.checkedAt).toLocaleTimeString()
    : 'checking…';

  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] px-10 py-24">
      <div className="max-w-[720px] mx-auto">
        <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-6">System Status</div>
        <div className="flex items-center gap-3 mb-3">
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: allOk ? '#00ff94' : '#fbbf24' }}
          />
          <h1 className="font-mono text-[38px] font-semibold tracking-[-2px] leading-none">
            {loading ? 'Checking…' : allOk ? 'All systems operational' : 'Partial degradation'}
          </h1>
        </div>
        <p className="text-[14px] text-[#4a5568] font-mono mb-14">
          Last checked: {checkedAt}
        </p>

        <div className="flex flex-col border border-[#1a1f28] rounded-lg overflow-hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-4 bg-[#0a0c0f] ${i < 3 ? 'border-b border-[#1a1f28]' : ''}`}
                >
                  <div className="h-3 w-32 rounded bg-[#1a1f28] animate-pulse" />
                  <div className="h-3 w-20 rounded bg-[#1a1f28] animate-pulse" />
                </div>
              ))
            : (data?.services ?? []).map((svc, i) => (
                <div
                  key={svc.name}
                  className={`flex items-center justify-between px-6 py-4 bg-[#0a0c0f] ${i < (data?.services.length ?? 1) - 1 ? 'border-b border-[#1a1f28]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[svc.status] }}
                    />
                    <span className="font-mono text-[13px] text-[#e8edf5]">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    {svc.latency && (
                      <span className="font-mono text-[12px] text-[#4a5568]">{svc.latency}</span>
                    )}
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest"
                      style={{ color: STATUS_COLOR[svc.status] }}
                    >
                      {STATUS_LABEL[svc.status]}
                    </span>
                  </div>
                </div>
              ))}
        </div>

        <div className="mt-10 flex items-center gap-4">
          <a
            href="/"
            className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all no-underline"
          >
            ← Back to home
          </a>
          <button
            onClick={() => void refresh()}
            className="font-mono text-[12px] text-[#4a5568] border border-[#1a1f28] px-5 py-2.5 rounded uppercase tracking-wider hover:text-[#e8edf5] hover:border-[#2a2f38] transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}
