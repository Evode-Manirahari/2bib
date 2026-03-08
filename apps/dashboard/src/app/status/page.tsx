const services = [
  { name: 'API Gateway', status: 'operational', latency: '42ms' },
  { name: 'FHIR Proxy', status: 'operational', latency: '118ms' },
  { name: 'Validator', status: 'operational', latency: '67ms' },
  { name: 'PA Simulator', status: 'operational', latency: '89ms' },
  { name: 'PA Agent', status: 'operational', latency: '2.1s' },
  { name: 'Dashboard', status: 'operational', latency: '24ms' },
];

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] px-10 py-24">
      <div className="max-w-[720px] mx-auto">
        <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-6">System Status</div>
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00ff94] animate-pulse" />
          <h1 className="font-mono text-[38px] font-semibold tracking-[-2px] leading-none">All systems operational</h1>
        </div>
        <p className="text-[14px] text-[#4a5568] font-mono mb-14">Last checked: just now</p>

        <div className="flex flex-col border border-[#1a1f28] rounded-lg overflow-hidden">
          {services.map((svc, i) => (
            <div
              key={svc.name}
              className={`flex items-center justify-between px-6 py-4 bg-[#0a0c0f] ${i < services.length - 1 ? 'border-b border-[#1a1f28]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-[#00ff94]" />
                <span className="font-mono text-[13px] text-[#e8edf5]">{svc.name}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-mono text-[12px] text-[#4a5568]">{svc.latency}</span>
                <span className="font-mono text-[11px] text-[#00ff94] uppercase tracking-widest">{svc.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <a href="/" className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all no-underline">
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
