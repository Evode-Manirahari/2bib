'use client';

import { useEffect, useState } from 'react';
import { fetchMe, getStoredApiKey, clearStoredApiKey, type MeResponse } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setLoading(false); return; }
    fetchMe(key)
      .then(setMe)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    clearStoredApiKey();
    window.location.href = '/';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and project details.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Account */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground mb-4">Account</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-4 w-40 rounded bg-muted animate-pulse" />)}
          </div>
        ) : me ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Project ID</dt>
            <dd className="font-mono text-xs text-foreground">{me.projectId}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="text-foreground">{me.tier}</dd>
            <dt className="text-muted-foreground">Daily limit</dt>
            <dd className="text-foreground">{me.rateLimit.toLocaleString()} calls/day</dd>
            <dt className="text-muted-foreground">Total calls</dt>
            <dd className="text-foreground">{me.callCount.toLocaleString()}</dd>
            <dt className="text-muted-foreground">Key created</dt>
            <dd className="text-foreground">{formatDate(me.createdAt)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No account data found.{' '}
            <a href="/get-started" className="text-primary hover:underline">Get started →</a>
          </p>
        )}
      </div>

      {/* Resources */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground mb-3">Resources</h2>
        <div className="flex flex-col gap-2 text-sm">
          <a href="/docs" className="text-primary hover:underline">API Documentation →</a>
          <a href="/status" className="text-primary hover:underline">System Status →</a>
          <a
            href="https://github.com/evode/pe"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            GitHub →
          </a>
          <a href="mailto:hello@getpe.dev" className="text-primary hover:underline">
            Support: hello@getpe.dev →
          </a>
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground mb-1">Session</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Clears your stored API key from this browser. Your key and account data are not deleted.
        </p>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          Clear session
        </button>
      </div>
    </div>
  );
}
