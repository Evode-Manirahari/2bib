'use client';
import { useState } from 'react';
import { setStoredApiKey } from '@/lib/api';
import { useRouter } from 'next/navigation';

type State = 'form' | 'loading' | 'success' | 'exists' | 'error';

interface RegisterResponse {
  rawKey?: string;
  prefix?: string;
  userId?: string;
  projectId?: string;
  alreadyExists?: boolean;
  message?: string;
  error?: string;
}

export default function GetStartedPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('form');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });

      const data = await res.json() as RegisterResponse;

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong.');
        setState('error');
        return;
      }

      setResult(data);
      setState(data.alreadyExists ? 'exists' : 'success');
    } catch {
      setErrorMsg('Could not connect to the server. Is the API running?');
      setState('error');
    }
  }

  function handleOpenDashboard() {
    if (result?.rawKey) {
      setStoredApiKey(result.rawKey);
    }
    router.push('/dashboard');
  }

  async function handleCopy() {
    if (result?.rawKey) {
      await navigator.clipboard.writeText(result.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] flex flex-col items-center justify-center px-10">
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 mb-10 no-underline w-fit">
          <div className="w-7 h-7 bg-[#00d4ff] rounded-md flex items-center justify-center text-black text-xs font-semibold font-mono">
            Pe
          </div>
          <span className="font-mono text-lg font-semibold text-[#e8edf5] tracking-tight">Pe</span>
        </a>

        {/* ── FORM STATE ── */}
        {(state === 'form' || state === 'loading') && (
          <div className="bg-[#0a0c0f] border border-[#1a1f28] rounded-lg p-8">
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-3">Get started free</div>
            <h1 className="font-mono text-[26px] font-semibold tracking-[-1px] leading-[1.1] mb-2">
              Get your API key.
            </h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Enter your email to generate a free API key. No credit card required.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] text-[#7a8699] uppercase tracking-widest">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="bg-[#050608] border border-[#242b36] rounded px-4 py-2.5 font-mono text-[13px] text-[#e8edf5] placeholder-[#4a5568] focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] text-[#7a8699] uppercase tracking-widest">
                  Name <span className="text-[#4a5568] normal-case tracking-normal font-sans">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[#050608] border border-[#242b36] rounded px-4 py-2.5 font-mono text-[13px] text-[#e8edf5] placeholder-[#4a5568] focus:outline-none focus:border-[#00d4ff] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={state === 'loading'}
                className="font-mono text-[13px] font-medium text-black bg-[#00d4ff] px-6 py-3 rounded uppercase tracking-wider hover:opacity-85 transition-opacity disabled:opacity-50 mt-2"
              >
                {state === 'loading' ? 'Generating…' : 'Generate API Key →'}
              </button>
            </form>

            <p className="text-[12px] text-[#4a5568] mt-5 text-center">
              Already have a key?{' '}
              <a href="/dashboard" className="text-[#00d4ff] no-underline hover:underline">
                Open dashboard
              </a>
            </p>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {state === 'success' && result?.rawKey && (
          <div className="bg-[#0a0c0f] border border-[#1a1f28] rounded-lg p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#00ff94]" />
              <span className="font-mono text-[11px] text-[#00ff94] uppercase tracking-widest">Key generated</span>
            </div>
            <h1 className="font-mono text-[24px] font-semibold tracking-[-1px] leading-[1.1] mb-2">
              Your API key is ready.
            </h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-6">
              Copy it now — <span className="text-[#e8edf5]">this is the only time it will be shown.</span>
            </p>

            {/* Key display */}
            <div className="bg-[#050608] border border-[#242b36] rounded-md px-4 py-3 flex items-center justify-between gap-3 mb-6">
              <code className="font-mono text-[13px] text-[#00d4ff] break-all">{result.rawKey}</code>
              <button
                onClick={handleCopy}
                className="font-mono text-[11px] text-[#7a8699] border border-[#242b36] px-2.5 py-1 rounded uppercase tracking-wider hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all flex-shrink-0"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="bg-[rgba(0,212,255,0.04)] border border-[rgba(0,212,255,0.15)] rounded px-4 py-3 mb-6">
              <p className="font-mono text-[12px] text-[#7a8699]">
                <span className="text-[#00d4ff]">Free tier:</span> 1,000 API calls/day · FHIR Proxy · Validator · PA Simulator
              </p>
            </div>

            <button
              onClick={handleOpenDashboard}
              className="font-mono text-[13px] font-medium text-black bg-[#00d4ff] px-6 py-3 rounded uppercase tracking-wider hover:opacity-85 transition-opacity w-full"
            >
              Open Dashboard →
            </button>
          </div>
        )}

        {/* ── ALREADY EXISTS STATE ── */}
        {state === 'exists' && result && (
          <div className="bg-[#0a0c0f] border border-[#1a1f28] rounded-lg p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <span className="font-mono text-[11px] text-[#febc2e] uppercase tracking-widest">Key exists</span>
            </div>
            <h1 className="font-mono text-[24px] font-semibold tracking-[-1px] leading-[1.1] mb-2">
              You already have a key.
            </h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-6">
              {result.message}
            </p>
            <div className="bg-[#050608] border border-[#242b36] rounded-md px-4 py-3 mb-6">
              <p className="font-mono text-[12px] text-[#7a8699]">Key prefix: <span className="text-[#e8edf5]">{result.prefix}…</span></p>
            </div>
            <a
              href="/dashboard"
              className="font-mono text-[13px] font-medium text-black bg-[#00d4ff] px-6 py-3 rounded uppercase tracking-wider hover:opacity-85 transition-opacity block text-center no-underline"
            >
              Open Dashboard →
            </a>
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {state === 'error' && (
          <div className="bg-[#0a0c0f] border border-[#1a1f28] rounded-lg p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <span className="font-mono text-[11px] text-[#ff5f57] uppercase tracking-widest">Error</span>
            </div>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-6">{errorMsg}</p>
            <button
              onClick={() => setState('form')}
              className="font-mono text-[13px] text-[#7a8699] border border-[#242b36] px-6 py-3 rounded uppercase tracking-wider hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all"
            >
              ← Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
