'use client';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-10 pt-28 pb-20 text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 font-mono text-[11px] text-[#00d4ff] bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.2)] px-3.5 py-1.5 rounded-sm uppercase tracking-widest mb-10 animate-fade-up">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
        CMS-0057 mandates FHIR APIs by Jan 2027
      </div>

      {/* Title */}
      <h1 className="font-mono text-[clamp(40px,6vw,76px)] font-semibold leading-[1.05] tracking-[-2px] text-[#e8edf5] mb-6 animate-fade-up [animation-delay:100ms]">
        FHIR integration<br />
        <span className="text-[#00d4ff]">without the headache.</span>
      </h1>

      {/* Subtitle */}
      <p className="text-[17px] text-[#7a8699] max-w-[520px] leading-[1.7] mb-12 animate-fade-up [animation-delay:200ms]">
        One API key. Unified auth across every payer. Normalized FHIR responses,
        built-in PA simulator, and an autonomous prior auth agent — all in one platform.
      </p>

      {/* CTAs */}
      <div className="flex gap-3 items-center mb-18 animate-fade-up [animation-delay:300ms]">
        <Link
          href="/get-started"
          className="font-mono text-[13px] font-medium text-black bg-[#00d4ff] border-0 px-6 py-3 rounded no-underline uppercase tracking-wider hover:opacity-85 hover:-translate-y-px transition-all"
        >
          Get API Key — Free
        </Link>
        <Link
          href="/docs"
          className="font-mono text-[13px] text-[#7a8699] bg-transparent border border-[#242b36] px-6 py-3 rounded no-underline uppercase tracking-wider hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all"
        >
          View Docs
        </Link>
      </div>

      {/* Code window */}
      <div className="w-full max-w-[680px] bg-[#0a0c0f] border border-[#1a1f28] rounded-lg overflow-hidden text-left animate-fade-up [animation-delay:400ms] shadow-[0_0_60px_rgba(0,212,255,0.06)]">
        {/* Titlebar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1216] border-b border-[#1a1f28]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[11px] text-[#4a5568] tracking-wide">TypeScript — quickstart.ts</span>
          <span />
        </div>

        {/* Code body */}
        <div className="p-6 font-mono text-[13px] leading-[1.8]">
          <div>
            <span className="text-[#ff79c6]">import</span>
            <span className="text-[#6272a4]"> {'{ '}</span>
            <span className="text-[#00d4ff]">createClient</span>
            <span className="text-[#6272a4]">{' }'}</span>
            <span className="text-[#ff79c6]"> from</span>
            <span className="text-[#00ff94]"> &apos;@pe/sdk&apos;</span>
            <span className="text-[#6272a4]">;</span>
          </div>
          <br />
          <div className="text-[#4a5568]">{'// One key connects to any payer or EHR'}</div>
          <div>
            <span className="text-[#ff79c6]">const</span>
            <span className="text-[#e8edf5]"> pe </span>
            <span className="text-[#6272a4]">=</span>
            <span className="text-[#00d4ff]"> createClient</span>
            <span className="text-[#6272a4]">{'({'}</span>
            <span className="text-[#bd93f9]"> apiKey</span>
            <span className="text-[#6272a4]">:</span>
            <span className="text-[#00ff94]"> &apos;pe_live_...&apos;</span>
            <span className="text-[#6272a4]">{' });'}</span>
          </div>
          <br />
          <div className="text-[#4a5568]">{'// Read a FHIR Patient from any payer'}</div>
          <div>
            <span className="text-[#ff79c6]">const</span>
            <span className="text-[#e8edf5]"> patient </span>
            <span className="text-[#6272a4]">=</span>
            <span className="text-[#ff79c6]"> await</span>
            <span className="text-[#e8edf5]"> pe</span>
            <span className="text-[#6272a4]">.</span>
            <span className="text-[#00d4ff]">fhir.read</span>
            <span className="text-[#6272a4]">(</span>
            <span className="text-[#00ff94]">&apos;Patient&apos;</span>
            <span className="text-[#6272a4]">, </span>
            <span className="text-[#00ff94]">&apos;123&apos;</span>
            <span className="text-[#6272a4]">);</span>
          </div>
          <br />
          <div className="text-[#4a5568]">{'// Run autonomous prior authorization'}</div>
          <div>
            <span className="text-[#ff79c6]">const</span>
            <span className="text-[#e8edf5]"> result </span>
            <span className="text-[#6272a4]">=</span>
            <span className="text-[#ff79c6]"> await</span>
            <span className="text-[#e8edf5]"> pe</span>
            <span className="text-[#6272a4]">.</span>
            <span className="text-[#00d4ff]">pa.run</span>
            <span className="text-[#6272a4]">{'({'}</span>
          </div>
          <div>
            <span className="text-[#bd93f9]">&nbsp;&nbsp;patient</span>
            <span className="text-[#6272a4]">: </span>
            <span className="text-[#e8edf5]">patient</span>
            <span className="text-[#6272a4]">,</span>
          </div>
          <div>
            <span className="text-[#bd93f9]">&nbsp;&nbsp;procedure</span>
            <span className="text-[#6272a4]">: </span>
            <span className="text-[#00ff94]">&apos;MRI lumbar spine&apos;</span>
            <span className="text-[#6272a4]">,</span>
          </div>
          <div>
            <span className="text-[#bd93f9]">&nbsp;&nbsp;payerId</span>
            <span className="text-[#6272a4]">: </span>
            <span className="text-[#00ff94]">&apos;aetna-commercial&apos;</span>
          </div>
          <div><span className="text-[#6272a4]">{'});'}</span></div>
          <br />
          <div className="text-[#4a5568]">{'// → { status: "approved", confidence: 0.94 }'}</div>
        </div>
      </div>
    </section>
  );
}
