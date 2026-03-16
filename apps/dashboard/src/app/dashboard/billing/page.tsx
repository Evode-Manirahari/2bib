'use client';

import { useEffect, useState } from 'react';
import { getStoredApiKey } from '@/lib/api';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface BillingStatus {
  plan: string;
  tier: string;
  hasActiveSubscription: boolean;
}

interface Plan {
  tier: string;
  price: number | null;
  callsPerDay: number | null;
  features: string[];
}

const TIER_ORDER = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];

function formatPrice(cents: number | null) {
  if (cents === null) return 'Custom';
  if (cents === 0) return 'Free';
  return `$${cents / 100}/mo`;
}

function formatCalls(n: number | null) {
  if (n === null) return 'Unlimited';
  if (n >= 1_000_000) return `${n / 1_000_000}M / day`;
  if (n >= 1_000) return `${n / 1_000}k / day`;
  return `${n} / day`;
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setLoading(false); return; }

    void Promise.all([
      fetch(`${API_BASE}/v1/billing/status`, {
        headers: { Authorization: `Bearer ${key}` },
      }).then((r) => r.json() as Promise<BillingStatus>),
      fetch(`${API_BASE}/v1/billing/plans`).then((r) => r.json() as Promise<{ plans: Plan[] }>),
    ])
      .then(([s, p]) => {
        setStatus(s);
        setPlans(p.plans);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tier: string) => {
    const key = getStoredApiKey();
    if (!key) return;
    setUpgrading(tier);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/v1/billing/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Failed to create checkout session');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpgrading(null);
    }
  };

  const handleManage = async () => {
    const key = getStoredApiKey();
    if (!key) return;
    setUpgrading('portal');
    try {
      const res = await fetch(`${API_BASE}/v1/billing/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? 'Failed to open billing portal');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpgrading(null);
    }
  };

  const currentTierIdx = TIER_ORDER.indexOf(status?.tier ?? 'FREE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your plan and subscription.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-medium text-foreground mb-3">Current plan</h2>
        {loading ? (
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-foreground">{status?.tier ?? 'FREE'}</span>
            {status?.hasActiveSubscription && (
              <span className="rounded-full bg-emerald-500/10 text-emerald-500 text-xs px-2 py-0.5 font-medium">
                Active
              </span>
            )}
            {status?.hasActiveSubscription && (
              <button
                onClick={() => void handleManage()}
                disabled={upgrading === 'portal'}
                className="ml-auto text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent disabled:opacity-50"
              >
                {upgrading === 'portal' ? 'Opening…' : 'Manage billing →'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(loading ? Array.from({ length: 4 }) : plans).map((plan, i) => {
          if (!plan) {
            return (
              <div key={i} className="rounded-lg border border-border bg-card p-5 animate-pulse">
                <div className="h-4 w-20 rounded bg-muted mb-3" />
                <div className="h-6 w-16 rounded bg-muted mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => <div key={j} className="h-3 w-full rounded bg-muted" />)}
                </div>
              </div>
            );
          }
          const p = plan as Plan;
          const tierIdx = TIER_ORDER.indexOf(p.tier);
          const isCurrent = p.tier === (status?.tier ?? 'FREE');
          const isUpgrade = tierIdx > currentTierIdx;

          return (
            <div
              key={p.tier}
              className={`rounded-lg border bg-card p-5 flex flex-col ${isCurrent ? 'border-primary' : 'border-border'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-semibold text-foreground">{p.tier}</span>
                {isCurrent && (
                  <span className="text-[10px] text-primary font-mono uppercase tracking-wider">current</span>
                )}
              </div>
              <div className="font-mono text-xl font-semibold text-foreground mb-1">
                {formatPrice(p.price)}
              </div>
              <div className="text-xs text-muted-foreground mb-4">{formatCalls(p.callsPerDay)}</div>
              <ul className="flex flex-col gap-1.5 flex-1 mb-5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {p.tier === 'ENTERPRISE' ? (
                <a
                  href="mailto:hello@getpe.dev"
                  className="block text-center rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Contact us
                </a>
              ) : isCurrent ? (
                <button
                  disabled
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                >
                  Current plan
                </button>
              ) : isUpgrade ? (
                <button
                  onClick={() => void handleUpgrade(p.tier)}
                  disabled={!!upgrading}
                  className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {upgrading === p.tier ? 'Redirecting…' : `Upgrade to ${p.tier}`}
                </button>
              ) : (
                <button
                  disabled
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                >
                  Downgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
