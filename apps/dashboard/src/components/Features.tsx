const features = [
  {
    icon: '⟷',
    name: 'FHIR Proxy',
    desc: 'One API key connects to any payer or EHR. Pe handles SMART on FHIR auth and normalizes responses across all endpoints.',
  },
  {
    icon: '✓',
    name: 'Validator',
    desc: 'Validate any FHIR resource against US Core, Da Vinci PAS, CRD, and DTR. AI-powered error explanations and one-click fixes.',
  },
  {
    icon: '⬡',
    name: 'PA Simulator',
    desc: 'Simulate end-to-end prior auth workflows against Aetna, UHC, Cigna, Anthem, and Medicare Advantage. No real payer access needed.',
  },
  {
    icon: '▶',
    name: 'Workflow Runner',
    desc: 'Define FHIR workflows in YAML and execute them reproducibly in CI/CD. 10 pre-built PA templates included.',
  },
  {
    icon: '◈',
    name: 'AI Layer',
    desc: 'Natural language to FHIR query. Auto-fix validation errors. AI-generated synthetic patient data seeded from Synthea.',
  },
  {
    icon: '▦',
    name: 'Analytics',
    desc: 'Real-time request logs, usage charts, error rate tracking, and Stripe billing — all in the developer dashboard.',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative z-10 px-10 py-24 max-w-[1200px] mx-auto">
      <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
        <span className="w-6 h-px bg-[#00d4ff]" />
        Platform
      </div>
      <h2 className="font-mono text-[clamp(28px,3.5vw,44px)] font-semibold tracking-[-1.5px] leading-[1.1] text-[#e8edf5] mb-5">
        Everything you need<br />to ship healthcare apps.
      </h2>
      <p className="text-[16px] text-[#7a8699] max-w-[500px] leading-[1.7] mb-16">
        Stop reading 400-page HL7 implementation guides. Pe handles the hard parts so you can focus on your product.
      </p>

      <div
        className="grid grid-cols-3 rounded-lg overflow-hidden border border-[#1a1f28]"
        style={{ gap: '1px', background: '#1a1f28' }}
      >
        {features.map((f) => (
          <div
            key={f.name}
            className="group bg-[#0a0c0f] p-8 relative overflow-hidden hover:bg-[#0f1216] transition-colors"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00d4ff] scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300" />
            <div className="w-9 h-9 border border-[#242b36] rounded-md flex items-center justify-center mb-5 text-base bg-[#0f1216]">
              {f.icon}
            </div>
            <div className="font-mono text-sm font-medium text-[#e8edf5] mb-2.5 tracking-tight">
              {f.name}
            </div>
            <div className="text-[13px] text-[#7a8699] leading-[1.65]">{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
