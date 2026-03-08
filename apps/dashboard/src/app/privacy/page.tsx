const sections = [
  {
    title: 'What we collect',
    body: 'Pe collects API usage metadata (request counts, latency, error rates), billing information via Stripe, and account information (email, plan tier). We do not store the contents of FHIR resources you send through the proxy — they are forwarded and discarded.',
  },
  {
    title: 'How we use it',
    body: 'Usage data is used to enforce rate limits, generate billing records, display your dashboard analytics, and improve platform reliability. We do not sell or share your data with third parties.',
  },
  {
    title: 'HIPAA',
    body: 'Pe is a developer tool and infrastructure platform. In production, PHI should flow only through your own FHIR endpoints. Enterprise plans include a signed Business Associate Agreement (BAA). Contact us for details.',
  },
  {
    title: 'Data retention',
    body: 'Request logs are retained for 30 days on Free/Starter plans, 90 days on Growth, and configurable on Enterprise. Billing records are retained as required by law.',
  },
  {
    title: 'Contact',
    body: 'Questions? Email privacy@pe.dev or open an issue on GitHub.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050608] text-[#e8edf5] px-10 py-24">
      <div className="max-w-[680px] mx-auto">
        <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-6">Legal</div>
        <h1 className="font-mono text-[42px] font-semibold tracking-[-2px] leading-[1.1] mb-3">Privacy Policy</h1>
        <p className="font-mono text-[13px] text-[#4a5568] mb-14">Effective: January 1, 2026</p>

        <div className="flex flex-col gap-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="font-mono text-[15px] font-semibold text-[#e8edf5] mb-2.5">{s.title}</h2>
              <p className="text-[14px] text-[#7a8699] leading-[1.75]">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-[#1a1f28]">
          <a href="/" className="font-mono text-[12px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-5 py-2.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all no-underline">
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
