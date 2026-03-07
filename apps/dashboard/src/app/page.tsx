export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 py-32 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          CMS-0057 mandates FHIR APIs by Jan 2027 — build ready today
        </div>
        <h1 className="mb-6 max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          FHIR integration
          <br />
          <span className="text-primary">in minutes.</span>
        </h1>
        <p className="mb-10 max-w-xl text-lg text-muted-foreground">
          Stripe meets Postman — for healthcare APIs. One API key, unified auth, normalized FHIR
          responses, and a built-in prior auth simulator.
        </p>

        <div className="flex gap-4">
          <a
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Get API Key — Free
          </a>
          <a
            href="#docs"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            View Docs
          </a>
        </div>

        {/* Code snippet */}
        <div className="mt-16 w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card text-left">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">TypeScript</span>
          </div>
          <pre className="overflow-x-auto p-6 text-sm text-foreground">
            <code>{`import { createClient } from '@pe/sdk';

const pe = createClient({ apiKey: 'pe_live_...' });

// Read a FHIR Patient from any payer
const patient = await pe.fhir.read('Patient', '123');

// Natural language → FHIR query
const results = await pe.query(
  'patients with diabetes diagnosed after 2022'
);

// Simulate prior authorization (Aetna)
const pa = await pe.pa.submit(claim, {
  payer: 'aetna-commercial',
});`}</code>
          </pre>
        </div>
      </section>

      {/* Feature cards */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Everything you need to ship</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-card p-6">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Simple, usage-based pricing</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-lg border p-6 ${
                  tier.featured
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card'
                }`}
              >
                <h3 className="mb-1 font-semibold">{tier.name}</h3>
                <p className={`mb-4 text-2xl font-bold`}>{tier.price}</p>
                <p
                  className={`mb-6 text-sm ${tier.featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                >
                  {tier.calls}
                </p>
                <a
                  href="/dashboard"
                  className={`inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    tier.featured
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'border border-border hover:bg-accent'
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-muted-foreground">
          <span>Pe — Build healthcare apps without the FHIR headache.</span>
          <div className="flex gap-6">
            <a href="#docs" className="hover:text-foreground">
              Docs
            </a>
            <a href="https://github.com/evode/pe" className="hover:text-foreground">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: '🔑',
    title: 'FHIR Proxy',
    description:
      'One API key connects to any payer or EHR. Pe handles SMART on FHIR auth and normalizes responses.',
  },
  {
    icon: '✅',
    title: 'Validator',
    description:
      'Validate any FHIR resource against US Core, Da Vinci PAS, CRD, and DTR Implementation Guides.',
  },
  {
    icon: '🏥',
    title: 'PA Simulator',
    description:
      'Simulate end-to-end prior auth workflows against Aetna, UHC, Cigna, Anthem, and Medicare profiles.',
  },
  {
    icon: '🔄',
    title: 'Workflow Runner',
    description:
      'Define FHIR workflows in YAML and execute them reproducibly in CI/CD. 10 pre-built PA templates.',
  },
  {
    icon: '🤖',
    title: 'AI Layer',
    description:
      'Natural language to FHIR query. Auto-fix validation errors. AI-generated synthetic patient data.',
  },
  {
    icon: '📊',
    title: 'Analytics',
    description:
      'Real-time request logs, usage charts, error rate tracking, and Stripe billing — all in the dashboard.',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0/mo',
    calls: '1,000 calls/mo',
    cta: 'Get started',
    featured: false,
  },
  {
    name: 'Starter',
    price: '$29/mo',
    calls: '50,000 calls/mo',
    cta: 'Start building',
    featured: true,
  },
  {
    name: 'Growth',
    price: '$99/mo',
    calls: '500,000 calls/mo',
    cta: 'Scale up',
    featured: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    calls: 'Unlimited',
    cta: 'Contact us',
    featured: false,
  },
];
