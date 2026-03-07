'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchMe, fetchLogs, getStoredApiKey, type MeResponse, type RequestLog } from '@/lib/api';
import { formatDate, formatDuration, formatNumber } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/badge';
import { ApiKeyModal } from '@/components/api-key-input';
import { Activity, Zap, AlertTriangle, Clock, RefreshCw, Key } from 'lucide-react';

export default function OverviewPage() {
  const [apiKey, setApiKey] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (key?: string) => {
    const k = key ?? apiKey;
    if (!k) return;
    setLoading(true);
    setError('');
    try {
      const [meData, logsData] = await Promise.all([
        fetchMe(k),
        fetchLogs({ pageSize: 10 }),
      ]);
      setMe(meData);
      setLogs(logsData.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (stored) {
      setApiKey(stored);
      void load(stored);
    } else {
      setShowModal(true);
    }
  }, [load]);

  const handleKeySave = (key: string) => {
    setApiKey(key);
    setShowModal(false);
    void load(key);
  };

  // Compute derived stats from logs
  const errorCount = logs.filter((l) => l.statusCode >= 500).length;
  const avgDuration =
    logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.durationMs, 0) / logs.length)
      : 0;

  return (
    <>
      {showModal && <ApiKeyModal onSave={handleKeySave} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Overview</h1>
            {me && (
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{me.prefix}...</span> · {me.tier} tier · Project{' '}
                <span className="font-mono text-xs">{me.projectId.slice(0, 8)}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <Key size={12} />
              API Key
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Calls"
            value={me ? formatNumber(me.callCount) : '—'}
            sub="lifetime"
            icon={<Activity size={15} />}
          />
          <StatCard
            title="Rate Limit"
            value={me ? formatNumber(me.rateLimit) : '—'}
            sub="calls / day"
            icon={<Zap size={15} />}
          />
          <StatCard
            title="Errors (recent)"
            value={logs.length ? `${errorCount} / ${logs.length}` : '—'}
            sub="5xx in last 10 requests"
            icon={<AlertTriangle size={15} />}
          />
          <StatCard
            title="Avg Latency"
            value={avgDuration ? formatDuration(avgDuration) : '—'}
            sub="last 10 requests"
            icon={<Clock size={15} />}
          />
        </div>

        {/* Recent logs */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Recent Requests</h2>
            <a href="/dashboard/logs" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </a>
          </div>

          {loading && logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No requests yet. Make your first API call.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-10 text-xs font-mono text-muted-foreground">{log.method}</span>
                  <span className="flex-1 truncate font-mono text-xs text-foreground">{log.path}</span>
                  <StatusBadge status={log.statusCode} />
                  <span className="w-14 text-right text-xs text-muted-foreground">
                    {formatDuration(log.durationMs)}
                  </span>
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick-start */}
        {me && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium text-foreground">Quick start</h2>
            <pre className="overflow-x-auto text-xs font-mono text-muted-foreground">
{`curl -H "Authorization: Bearer ${me.prefix}..." \\
  http://localhost:3001/v1/me`}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}
