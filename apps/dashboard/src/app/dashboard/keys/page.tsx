'use client';

import { useEffect, useState } from 'react';
import { fetchMe, rotateApiKey, getStoredApiKey, setStoredApiKey, type MeResponse } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Copy, RotateCcw, Eye, EyeOff, Key } from 'lucide-react';

export default function KeysPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [rotating, setRotating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNewKey, setShowNewKey] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setLoading(false); return; }
    fetchMe(key)
      .then(setMe)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const copyKey = (val: string) => {
    void navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRotate = async () => {
    setRotating(true);
    setError('');
    try {
      const result = await rotateApiKey();
      setStoredApiKey(result.rawKey);
      setNewKey(result.rawKey);
      setShowConfirm(false);
      // Refresh me with new key
      const updated = await fetchMe(result.rawKey);
      setMe(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">API Keys</h1>
        <p className="text-sm text-muted-foreground">View and manage your API key.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* New key banner */}
      {newKey && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-500 mb-2">New key generated — save it now. This is the only time it will be shown.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs text-foreground bg-background rounded border border-border px-3 py-2 overflow-x-auto">
              {showNewKey ? newKey : '•'.repeat(newKey.length)}
            </code>
            <button
              onClick={() => setShowNewKey((v) => !v)}
              className="p-2 rounded border border-border text-muted-foreground hover:bg-accent"
              title={showNewKey ? 'Hide' : 'Show'}
            >
              {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={() => copyKey(newKey)}
              className="p-2 rounded border border-border text-muted-foreground hover:bg-accent"
              title="Copy"
            >
              <Copy size={14} />
            </button>
          </div>
          {copied && <p className="text-xs text-emerald-500 mt-1">Copied!</p>}
        </div>
      )}

      {/* Current key card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Current API key</h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
          </div>
        ) : me ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="font-mono text-sm text-foreground bg-muted/50 rounded px-3 py-1.5">
                {me.prefix}••••••••••••••••••••••••••
              </code>
              <button
                onClick={() => copyKey(getStoredApiKey())}
                className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-accent"
              >
                <Copy size={11} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <span>Tier: <span className="text-foreground font-mono">{me.tier}</span></span>
              <span>Created: <span className="text-foreground">{formatDate(me.createdAt)}</span></span>
              {me.lastUsedAt && (
                <span>Last used: <span className="text-foreground">{formatDate(me.lastUsedAt)}</span></span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No API key found. <a href="/get-started" className="text-primary hover:underline">Get one →</a></p>
        )}
      </div>

      {/* Rotate section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground mb-1">Rotate key</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Generates a new API key and immediately revokes the current one. Update all your integrations before rotating.
        </p>

        {showConfirm ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-foreground mb-3">
              Are you sure? Your current key will be <strong>permanently revoked</strong>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleRotate()}
                disabled={rotating}
                className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {rotating ? 'Rotating…' : 'Yes, rotate key'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={rotating}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            <RotateCcw size={12} />
            Rotate API key
          </button>
        )}
      </div>
    </div>
  );
}
