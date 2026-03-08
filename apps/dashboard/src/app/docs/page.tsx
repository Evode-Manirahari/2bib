export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] flex flex-col items-center justify-center px-10">
      <div className="max-w-[600px] text-center">
        <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-6">Documentation</div>
        <h1 className="font-mono text-[42px] font-semibold tracking-[-2px] leading-[1.1] mb-5">
          Docs coming soon.
        </h1>
        <p className="text-[16px] text-[#7a8699] leading-[1.7] mb-10">
          Pe is in early access. Full API reference, quickstart guides, and SDK docs are on the way.
        </p>
        <a href="/" className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all no-underline">
          ← Back to home
        </a>
      </div>
    </main>
  );
}
