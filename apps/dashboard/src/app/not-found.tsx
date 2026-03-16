import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] flex items-center justify-center px-10">
      <div className="text-center">
        <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-6">404</div>
        <h1 className="font-mono text-[56px] font-semibold tracking-[-3px] leading-none mb-4">
          Not found.
        </h1>
        <p className="text-[15px] text-[#4a5568] font-mono mb-10">
          This page does not exist.
        </p>
        <Link
          href="/"
          className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
