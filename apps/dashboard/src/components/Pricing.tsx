const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    calls: '1,000 calls/mo',
    featured: false,
    features: [
      { text: 'FHIR Proxy', active: true },
      { text: 'Validator', active: true },
      { text: 'PA Simulator', active: true },
      { text: 'PA Agent', active: false },
      { text: 'Workflow Runner', active: false },
    ],
    cta: 'Get started',
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    calls: '50,000 calls/mo · $0.001 overage',
    featured: true,
    features: [
      { text: 'FHIR Proxy', active: true },
      { text: 'Validator', active: true },
      { text: 'PA Simulator', active: true },
      { text: 'PA Agent', active: true },
      { text: 'Workflow Runner', active: true },
    ],
    cta: 'Start building',
  },
  {
    name: 'Growth',
    price: '$99',
    period: '/mo',
    calls: '500,000 calls/mo · $0.0005 overage',
    featured: false,
    features: [
      { text: 'Everything in Starter', active: true },
      { text: 'Priority support', active: true },
      { text: 'Custom payer profiles', active: true },
      { text: 'SLA guarantee', active: true },
      { text: 'Team seats', active: true },
    ],
    cta: 'Scale up',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    calls: 'Unlimited · Custom SLA',
    featured: false,
    features: [
      { text: 'Everything in Growth', active: true },
      { text: 'On-prem deployment', active: true },
      { text: 'HIPAA BAA', active: true },
      { text: 'Dedicated support', active: true },
      { text: 'White-labeling', active: true },
    ],
    cta: 'Contact us',
  },
];

export default function Pricing() {
  return (
    <div id="pricing" className="relative z-10 px-10 pb-24">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-14">
          <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-[0.15em] mb-4 flex items-center justify-center gap-3">
            <span className="w-6 h-px bg-[#00d4ff]" />
            Pricing
            <span className="w-6 h-px bg-[#00d4ff]" />
          </div>
          <h2 className="font-mono text-[clamp(28px,3.5vw,44px)] font-semibold tracking-[-1.5px] leading-[1.1] text-[#e8edf5] mb-5">
            Simple, usage-based.
          </h2>
          <p className="text-[16px] text-[#7a8699] max-w-[400px] mx-auto leading-[1.7]">
            Start free. Scale as you grow. No contracts, no minimums.
          </p>
        </div>

        <div
          className="grid grid-cols-4 rounded-lg overflow-hidden border border-[#1a1f28]"
          style={{ gap: '1px', background: '#1a1f28' }}
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-9 ${plan.featured ? 'bg-[#0f1216]' : 'bg-[#0a0c0f]'}`}
            >
              {plan.featured && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 font-mono text-[9px] text-black bg-[#00d4ff] px-2.5 py-0.5 rounded-b tracking-widest uppercase">
                  POPULAR
                </div>
              )}

              <div className="font-mono text-[11px] text-[#7a8699] uppercase tracking-widest mb-3 mt-2">
                {plan.name}
              </div>
              <div className={`font-mono font-semibold tracking-[-2px] leading-none text-[#e8edf5] ${plan.price === 'Custom' ? 'text-[28px] tracking-[-1px]' : 'text-[38px]'}`}>
                {plan.price}
                {plan.period && <span className="text-[16px] text-[#7a8699] font-normal tracking-normal">{plan.period}</span>}
              </div>
              <div className="font-mono text-[12px] text-[#4a5568] mt-1 mb-7">{plan.calls}</div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className="text-[13px] text-[#7a8699] flex items-center gap-2.5">
                    <span className={`font-mono text-[11px] flex-shrink-0 ${f.active ? 'text-[#00d4ff]' : 'text-[#4a5568]'}`}>
                      {f.active ? '✓' : '—'}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              <a
                href="/dashboard"
                className={`font-mono text-[12px] font-medium uppercase tracking-wider py-2.5 px-5 rounded text-center no-underline transition-all block ${
                  plan.featured
                    ? 'bg-[#00d4ff] text-black hover:opacity-85'
                    : 'bg-transparent text-[#7a8699] border border-[#242b36] hover:border-[#00d4ff] hover:text-[#00d4ff]'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
