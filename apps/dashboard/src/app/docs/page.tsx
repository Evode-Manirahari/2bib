'use client';

import { useState } from 'react';
import Link from 'next/link';

const SECTIONS = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'fhir', label: 'FHIR API' },
  { id: 'validate', label: 'Validation' },
  { id: 'pa', label: 'Prior Auth' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'sdk', label: 'SDKs & CLI' },
  { id: 'errors', label: 'Errors' },
];

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group rounded-lg border border-[#1a1f28] bg-[#0a0c0f] overflow-hidden mb-5">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1f28]">
        <span className="font-mono text-[10px] text-[#4a5568] uppercase tracking-wider">{lang}</span>
        <button
          onClick={copy}
          className="font-mono text-[10px] text-[#4a5568] hover:text-[#00d4ff] uppercase tracking-wider transition-colors"
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] font-mono text-[#c8d6e5] leading-[1.7]">{code}</pre>
    </div>
  );
}

function Endpoint({
  method,
  path,
  description,
  auth = true,
}: {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
}) {
  const color =
    method === 'GET' ? '#00d4ff' : method === 'POST' ? '#00ff94' : method === 'DELETE' ? '#ef4444' : '#fbbf24';
  return (
    <div className="border border-[#1a1f28] rounded-lg px-4 py-3 mb-3 bg-[#0a0c0f]">
      <div className="flex items-center gap-3 mb-1">
        <span className="font-mono text-[11px] font-semibold" style={{ color }}>
          {method}
        </span>
        <code className="font-mono text-[12px] text-[#e8edf5]">{path}</code>
        {!auth && (
          <span className="font-mono text-[9px] text-[#4a5568] border border-[#2a2f38] px-1.5 py-0.5 rounded uppercase tracking-wider">
            public
          </span>
        )}
      </div>
      <p className="text-[12px] text-[#4a5568]">{description}</p>
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState('quickstart');

  return (
    <div className="min-h-screen bg-[#050608] text-[#e8edf5] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-[#1a1f28] pt-20 pb-10 px-6 sticky top-0 h-screen overflow-y-auto">
        <Link href="/" className="font-mono text-[13px] font-semibold text-[#e8edf5] mb-8 block">
          Pe
        </Link>
        <div className="font-mono text-[10px] text-[#4a5568] uppercase tracking-widest mb-3">Docs</div>
        <nav className="flex flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`text-left font-mono text-[12px] px-2 py-1.5 rounded transition-colors ${
                active === s.id
                  ? 'text-[#00d4ff] bg-[rgba(0,212,255,0.08)]'
                  : 'text-[#4a5568] hover:text-[#e8edf5]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-8 md:px-16 py-20 max-w-[760px]">
        {/* Quickstart */}
        {active === 'quickstart' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Documentation</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Quickstart</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Get a live API key and make your first FHIR request in under 2 minutes.
            </p>

            <h2 className="font-mono text-[16px] font-semibold text-[#e8edf5] mb-3">1. Get an API key</h2>
            <p className="text-[13px] text-[#7a8699] mb-4">
              Go to{' '}
              <Link href="/get-started" className="text-[#00d4ff] hover:underline">
                /get-started
              </Link>{' '}
              and enter your email. Your key is shown once — save it.
            </p>

            <h2 className="font-mono text-[16px] font-semibold text-[#e8edf5] mb-3">2. Make a request</h2>
            <CodeBlock
              lang="bash"
              code={`curl -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  https://api.getpe.dev/v1/me`}
            />
            <CodeBlock
              lang="json"
              code={`{
  "id": "ak_abc123",
  "prefix": "pe_live_abc1",
  "tier": "FREE",
  "callCount": 1,
  "rateLimit": 1000,
  "projectId": "proj_xyz"
}`}
            />

            <h2 className="font-mono text-[16px] font-semibold text-[#e8edf5] mb-3 mt-8">3. Query FHIR resources</h2>
            <CodeBlock
              lang="bash"
              code={`curl -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  "https://api.getpe.dev/v1/fhir/Patient?family=Smith"`}
            />

            <h2 className="font-mono text-[16px] font-semibold text-[#e8edf5] mb-3 mt-8">4. Validate a resource</h2>
            <CodeBlock
              lang="bash"
              code={`curl -X POST -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"resource": {"resourceType":"Patient","id":"p1"}}' \\
  https://api.getpe.dev/v1/validate`}
            />
          </div>
        )}

        {/* Authentication */}
        {active === 'authentication' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Authentication</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Authentication</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Pe uses API key authentication. Pass your key as a Bearer token on every request.
            </p>

            <h2 className="font-mono text-[16px] font-semibold mb-3">Bearer token</h2>
            <CodeBlock
              lang="bash"
              code={`Authorization: Bearer pe_live_YOUR_KEY`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Get a key</h2>
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://api.getpe.dev/v1/register \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com"}'`}
            />
            <CodeBlock
              lang="json"
              code={`{
  "rawKey": "pe_live_abc123...",
  "prefix": "pe_live_abc1",
  "userId": "usr_xyz",
  "projectId": "proj_xyz"
}`}
            />
            <p className="text-[12px] text-[#4a5568] mb-8">
              The <code className="text-[#e8edf5]">rawKey</code> is shown exactly once. Store it securely.
            </p>

            <h2 className="font-mono text-[16px] font-semibold mb-3">Rate limits</h2>
            <div className="border border-[#1a1f28] rounded-lg overflow-hidden mb-6">
              {[
                { tier: 'FREE', limit: '1,000 req/day', price: 'Free' },
                { tier: 'STARTER', limit: '50,000 req/day', price: '$29/mo' },
                { tier: 'GROWTH', limit: '500,000 req/day', price: '$99/mo' },
                { tier: 'ENTERPRISE', limit: 'Unlimited', price: 'Custom' },
              ].map((row, i, arr) => (
                <div
                  key={row.tier}
                  className={`flex items-center justify-between px-5 py-3 bg-[#0a0c0f] ${i < arr.length - 1 ? 'border-b border-[#1a1f28]' : ''}`}
                >
                  <code className="font-mono text-[12px] text-[#00d4ff]">{row.tier}</code>
                  <span className="font-mono text-[12px] text-[#e8edf5]">{row.limit}</span>
                  <span className="font-mono text-[12px] text-[#4a5568]">{row.price}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[#4a5568]">
              Rate limit headers: <code className="text-[#e8edf5]">X-RateLimit-Limit</code>,{' '}
              <code className="text-[#e8edf5]">X-RateLimit-Remaining</code>,{' '}
              <code className="text-[#e8edf5]">X-RateLimit-Reset</code>
            </p>
          </div>
        )}

        {/* FHIR API */}
        {active === 'fhir' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">FHIR API</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">FHIR API</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Proxy to a HAPI FHIR R4 server with Redis caching. All standard FHIR REST operations are supported.
            </p>

            <h2 className="font-mono text-[16px] font-semibold mb-4">Endpoints</h2>
            <Endpoint method="GET" path="/v1/fhir/:resourceType" description="Search FHIR resources (supports all standard search parameters)" />
            <Endpoint method="GET" path="/v1/fhir/:resourceType/:id" description="Read a specific FHIR resource by ID" />
            <Endpoint method="POST" path="/v1/fhir/:resourceType" description="Create a new FHIR resource" />
            <Endpoint method="PUT" path="/v1/fhir/:resourceType/:id" description="Update a FHIR resource" />
            <Endpoint method="DELETE" path="/v1/fhir/:resourceType/:id" description="Delete a FHIR resource" />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Example: search patients</h2>
            <CodeBlock
              lang="bash"
              code={`curl -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  "https://api.getpe.dev/v1/fhir/Patient?family=Smith&_count=10"`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-6">Payer targeting</h2>
            <p className="text-[13px] text-[#7a8699] mb-4">
              Route requests to a specific payer endpoint with the header:
            </p>
            <CodeBlock lang="bash" code={`X-Pe-Payer-Target: uhc-commercial`} />
            <p className="text-[12px] text-[#4a5568]">
              Supported: <code className="text-[#e8edf5]">uhc-commercial</code>,{' '}
              <code className="text-[#e8edf5]">aetna-commercial</code>,{' '}
              <code className="text-[#e8edf5]">cigna-commercial</code>,{' '}
              <code className="text-[#e8edf5]">anthem-bcbs</code>,{' '}
              <code className="text-[#e8edf5]">medicare-advantage-humana</code>
            </p>
          </div>
        )}

        {/* Validation */}
        {active === 'validate' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Validation</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Validation</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Validate FHIR R4 resources against structural rules, HL7 official validator, US Core, and Da Vinci profiles.
            </p>

            <Endpoint method="GET" path="/v1/validate/profiles" description="List available validation profiles" />
            <Endpoint method="POST" path="/v1/validate" description="Validate a FHIR resource. Returns errors, warnings, and AI suggestions." />
            <Endpoint method="POST" path="/v1/validate/fix" description="AI auto-fix: returns a corrected resource with a change summary." />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Request body</h2>
            <CodeBlock
              lang="json"
              code={`{
  "resource": { "resourceType": "Patient", "id": "p1" },
  "profile": "us-core-3.1.1",
  "mode": "auto",
  "enrich": true
}`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-6">Response</h2>
            <CodeBlock
              lang="json"
              code={`{
  "isValid": false,
  "errorCount": 1,
  "warningCount": 0,
  "errors": [
    {
      "severity": "error",
      "category": "required",
      "path": "Patient.name",
      "message": "name is required by US Core Patient profile",
      "suggestion": "Add at least one HumanName element",
      "igLink": "https://hl7.org/fhir/us/core/StructureDefinition-us-core-patient.html"
    }
  ],
  "profile": "us-core-3.1.1",
  "engine": "structural",
  "durationMs": 12
}`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-6">Profiles</h2>
            <div className="font-mono text-[12px] text-[#4a5568] flex flex-col gap-1">
              {['structural', 'hl7-fhir-r4', 'us-core-3.1.1', 'us-core-6.1.0', 'davinci-pas', 'davinci-crd'].map((p) => (
                <code key={p} className="text-[#e8edf5]">{p}</code>
              ))}
            </div>
          </div>
        )}

        {/* Prior Auth */}
        {active === 'pa' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Prior Authorization</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Prior Auth</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Simulate prior authorization workflows against realistic payer profiles. Test approval, denial, appeal, and peer-to-peer flows.
            </p>

            <Endpoint method="GET" path="/v1/pa/payers" description="List available payer profiles with approval rates" />
            <Endpoint method="POST" path="/v1/pa/submit" description="Submit a PA request. Returns simulation ID and initial timeline." />
            <Endpoint method="GET" path="/v1/pa/:id" description="Get PA simulation status and current timeline" />
            <Endpoint method="GET" path="/v1/pa/:id/timeline" description="Get full PA timeline with all events" />
            <Endpoint method="POST" path="/v1/pa/:id/info" description="Submit additional information for a pended PA" />
            <Endpoint method="POST" path="/v1/pa/:id/appeal" description="Submit an appeal for a denied PA" />
            <Endpoint method="POST" path="/v1/pa/run" description="Run full PA Orchestrator Agent (CRD → DTR → PAS)" />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Submit a PA</h2>
            <CodeBlock
              lang="bash"
              code={`curl -X POST -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "payerId": "uhc-commercial",
    "patientRef": "Patient/pat-001",
    "icd10": "C50.911",
    "cptCode": "96413",
    "scenario": "auto"
  }' \\
  https://api.getpe.dev/v1/pa/submit`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-6">Payers</h2>
            <div className="border border-[#1a1f28] rounded-lg overflow-hidden">
              {[
                { id: 'uhc-commercial', name: 'UnitedHealthcare', approveRate: '65%' },
                { id: 'aetna-commercial', name: 'Aetna', approveRate: '70%' },
                { id: 'cigna-commercial', name: 'Cigna (P2P)', approveRate: '60%' },
                { id: 'anthem-bcbs', name: 'Anthem BCBS', approveRate: '68%' },
                { id: 'medicare-advantage-humana', name: 'Humana MA (P2P)', approveRate: '55%' },
              ].map((p, i, arr) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-5 py-3 bg-[#0a0c0f] ${i < arr.length - 1 ? 'border-b border-[#1a1f28]' : ''}`}
                >
                  <code className="font-mono text-[12px] text-[#00d4ff]">{p.id}</code>
                  <span className="font-mono text-[12px] text-[#e8edf5]">{p.name}</span>
                  <span className="font-mono text-[12px] text-[#4a5568]">{p.approveRate} auto-approve</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflows */}
        {active === 'workflows' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Workflows</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Workflows</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              YAML-based workflow runner for multi-step FHIR test scenarios. Chain validate, PA submit, FHIR reads, and assertions.
            </p>

            <Endpoint method="GET" path="/v1/workflows/templates" description="List available workflow templates" />
            <Endpoint method="POST" path="/v1/workflows/run" description="Execute a workflow template with variable substitution" />
            <Endpoint method="GET" path="/v1/workflows" description="List past workflow runs with status and steps" />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Run a workflow</h2>
            <CodeBlock
              lang="bash"
              code={`curl -X POST -H "Authorization: Bearer pe_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"templateName": "pa-happy-path"}' \\
  https://api.getpe.dev/v1/workflows/run`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-6">Workflow YAML format</h2>
            <CodeBlock
              lang="yaml"
              code={`name: pa-happy-path
description: Submit PA and verify approval
steps:
  - name: submit-pa
    action: pa-submit
    input:
      payerId: uhc-commercial
      scenario: auto-approve
  - name: check-status
    action: pa-status
    input:
      id: "{{ steps.submit-pa.output.id }}"
  - name: assert-approved
    action: assert
    input:
      value: "{{ steps.check-status.output.currentStatus }}"
      equals: APPROVED`}
            />
          </div>
        )}

        {/* SDKs & CLI */}
        {active === 'sdk' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">SDKs & CLI</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">SDKs & CLI</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              Official TypeScript SDK, Python SDK, and CLI tool.
            </p>

            <h2 className="font-mono text-[16px] font-semibold mb-3">TypeScript SDK</h2>
            <CodeBlock lang="bash" code={`npm install @pe/sdk`} />
            <CodeBlock
              lang="typescript"
              code={`import { createClient } from '@pe/sdk';

const pe = createClient({ apiKey: 'pe_live_YOUR_KEY' });

// FHIR
const bundle = await pe.fhir.search('Patient', { family: 'Smith' });

// Validate
const result = await pe.validate.resource(patientJson, { enrich: true });

// Prior auth
const sim = await pe.pa.submit({
  payerId: 'uhc-commercial',
  patientRef: 'Patient/p1',
  cptCode: '96413',
});`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">Python SDK</h2>
            <CodeBlock lang="bash" code={`pip install pe-sdk`} />
            <CodeBlock
              lang="python"
              code={`from pe import PeClient

with PeClient(api_key="pe_live_YOUR_KEY") as pe:
    # FHIR search
    bundle = pe.fhir.search("Patient", family="Smith")

    # Validate
    result = pe.validate.resource(patient_dict, enrich=True)

    # Prior auth
    sim = pe.pa.submit(
        payer_id="uhc-commercial",
        patient_ref="Patient/p1",
        cpt_code="96413",
    )`}
            />

            <h2 className="font-mono text-[16px] font-semibold mb-3 mt-8">CLI</h2>
            <CodeBlock lang="bash" code={`npm install -g pe-cli`} />
            <CodeBlock
              lang="bash"
              code={`# Authenticate
pe auth login

# Validate a FHIR file
pe validate patient.json --enrich

# Submit PA
pe pa run --payer uhc-commercial --patient p1 --procedure 96413

# Run a workflow
pe workflow run pa-happy-path`}
            />
          </div>
        )}

        {/* Errors */}
        {active === 'errors' && (
          <div>
            <div className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest mb-4">Errors</div>
            <h1 className="font-mono text-[36px] font-semibold tracking-[-2px] mb-3">Error Codes</h1>
            <p className="text-[14px] text-[#7a8699] leading-[1.7] mb-8">
              All errors return JSON with <code className="text-[#e8edf5]">error</code> and{' '}
              <code className="text-[#e8edf5]">code</code> fields.
            </p>

            <CodeBlock
              lang="json"
              code={`{
  "error": "API key is invalid or revoked",
  "code": "INVALID_API_KEY"
}`}
            />

            <div className="border border-[#1a1f28] rounded-lg overflow-hidden">
              {[
                { status: '400', code: 'INVALID_EMAIL', desc: 'Email missing or malformed on registration' },
                { status: '401', code: 'MISSING_API_KEY', desc: 'Authorization header not provided' },
                { status: '401', code: 'INVALID_API_KEY', desc: 'Key not found or revoked' },
                { status: '429', code: 'RATE_LIMIT_EXCEEDED', desc: 'Daily call limit reached for your tier' },
                { status: '404', code: 'NOT_FOUND', desc: 'Endpoint does not exist' },
                { status: '503', code: 'BILLING_NOT_CONFIGURED', desc: 'Stripe price not set for requested tier' },
                { status: '500', code: 'INTERNAL_ERROR', desc: 'Unexpected server error' },
              ].map((row, i, arr) => (
                <div
                  key={row.code}
                  className={`flex items-start gap-4 px-5 py-3 bg-[#0a0c0f] ${i < arr.length - 1 ? 'border-b border-[#1a1f28]' : ''}`}
                >
                  <span className="font-mono text-[11px] text-[#4a5568] w-8 shrink-0 pt-0.5">{row.status}</span>
                  <code className="font-mono text-[11px] text-[#00d4ff] w-44 shrink-0">{row.code}</code>
                  <span className="font-mono text-[12px] text-[#7a8699]">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
