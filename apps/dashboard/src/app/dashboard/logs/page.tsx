'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchLogs, getStoredApiKey, type RequestLog } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';
import { StatusBadge } from '@/components/badge';
import { ApiKeyModal } from '@/components/api-key-input';
import { RefreshCw, ChevronLeft, ChevronRight, Copy } from 'lucide-react';

const PAGE_SIZE = 20;

// Filter bar
const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const STATUS_FILTERS = [
  { label: 'All', min: 0, max: 999 },
  { label: '2xx', min: 200, max: 299 },
  { label: '4xx', min: 400, max: 499 },
  { label: '5xx', min: 500, max: 599 },
];

export default function LogsPage() {
  const [showModal, setShowModal] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS[0]!);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

  function copyCurl(log: RequestLog) {
    const key = getStoredApiKey();
    const url = `${API_BASE}${log.path}`;
    const headers = `-H "Authorization: Bearer ${key}"`;
    const payerHeader = log.payerTarget ? ` \\\n  -H "X-Pe-Payer-Target: ${log.payerTarget}"` : '';
    const method = log.method !== 'GET' ? ` \\\n  -X ${log.method}` : '';
    const curl = `curl ${headers}${payerHeader}${method} \\\n  "${url}"`;
    void navigator.clipboard.writeText(curl);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const load = useCallback(async () => {
    const key = getStoredApiKey();
    if (!key) { setShowModal(true); return; }
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof fetchLogs>[0] = { page, pageSize: PAGE_SIZE };
      if (method !== 'ALL') params.method = method;
      if (statusFilter.min > 0) {
        params.minStatus = statusFilter.min;
        params.maxStatus = statusFilter.max;
      }
      const data = await fetchLogs(params);
      setLogs(data.data);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, method, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {showModal && <ApiKeyModal onSave={() => { setShowModal(false); void load(); }} />}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Request Logs</h1>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Method */}
          <div className="flex gap-1">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setPage(1); }}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  method === m
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex gap-1">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.label}
                onClick={() => { setStatusFilter(sf); setPage(1); }}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  statusFilter.label === sf.label
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Path</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Payer</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {log.method}
                      </td>
                      <td className="max-w-xs px-4 py-2.5 font-mono text-xs truncate">
                        {log.path}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={log.statusCode} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {log.payerTarget ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => copyCurl(log)}
                          title="Copy as cURL"
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Copy size={11} />
                          {copiedId === log.id ? 'copied!' : 'curl'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {total} total request{total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
