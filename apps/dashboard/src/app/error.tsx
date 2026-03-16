'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#050608] text-[#e8edf5] flex items-center justify-center px-10">
        <div className="text-center">
          <div className="font-mono text-[11px] text-[#ff4d4d] uppercase tracking-widest mb-6">Error</div>
          <h1 className="font-mono text-[42px] font-semibold tracking-[-2px] leading-none mb-4">
            Something went wrong.
          </h1>
          <p className="text-[14px] text-[#4a5568] font-mono mb-10">
            {error.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
