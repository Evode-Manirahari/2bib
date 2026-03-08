const steps = [
  { num: '01', name: 'Coverage fetch', desc: 'Pull patient coverage via SMART on FHIR' },
  { num: '02', name: 'CRD check', desc: 'CDS Hooks — is PA required?' },
  { num: '03', name: 'DTR collection', desc: 'AI fills documentation gaps from clinical notes' },
  { num: '04', name: 'PAS submission', desc: 'Da Vinci PAS bundle + X12 278 translation' },
  { num: '05', name: 'Decision polling', desc: 'Up to 48h async polling with persistence' },
  { num: '06', name: 'Auto-appeal', desc: 'AI writes denial appeal on your behalf' },
];

export default function PAAgent() {
  return (
    <div id="agent" className="relative z-10 px-10 pb-24">
      <div className="max-w-[1200px] mx-auto bg-[#0a0c0f] border border-[#1a1f28] rounded-lg overflow-hidden grid grid-cols-2">
        {/* Left */}
        <div className="p-14 border-r border-[#1a1f28]">
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#00ff94] bg-[rgba(0,255,148,0.08)] border border-[rgba(0,255,148,0.2)] px-2.5 py-1 rounded-sm uppercase tracking-widest mb-7">
            New — PA Agent
          </div>
          <h2 className="font-mono text-[34px] font-semibold tracking-[-1.5px] leading-[1.1] mb-5 text-[#e8edf5]">
            pe.pa.run()<br />does everything.
          </h2>
          <p className="text-[15px] text-[#7a8699] leading-[1.75] mb-9">
            One function call. Pe autonomously handles the full Da Vinci CRD → DTR → PAS pipeline — coverage check, documentation collection, submission, polling, and appeals.
          </p>

          <div className="flex flex-col">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`flex items-start gap-4 py-3.5 ${i < steps.length - 1 ? 'border-b border-[#1a1f28]' : ''}`}
              >
                <div className="font-mono text-[10px] text-[#00d4ff] bg-[rgba(0,212,255,0.12)] border border-[rgba(0,212,255,0.2)] w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.num}
                </div>
                <div>
                  <div className="font-mono text-[12px] font-medium text-[#e8edf5]">{step.name}</div>
                  <div className="text-[12px] text-[#4a5568] mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Terminal */}
        <div className="p-10 bg-[#050608] flex flex-col justify-center">
          <div className="bg-black border border-[#242b36] rounded-md overflow-hidden font-mono text-[12px]">
            <div className="bg-[#0f1216] border-b border-[#1a1f28] px-4 py-2 flex items-center justify-between text-[11px] text-[#4a5568]">
              <div className="flex items-center gap-2">
                <span>●</span> pe — terminal
              </div>
              <a href="/dashboard/pa" className="font-mono text-[10px] text-[#00d4ff] border border-[rgba(0,212,255,0.3)] px-2 py-0.5 rounded uppercase tracking-wider hover:bg-[rgba(0,212,255,0.08)] transition-all no-underline">
                Try it →
              </a>
            </div>
            <div className="p-5 leading-[2]">
              <div>
                <span className="text-[#00d4ff]">$</span>
                <span className="text-[#e8edf5]"> pe pa run --patient 123 --procedure &quot;MRI lumbar&quot; --payer aetna</span>
              </div>
              <div className="text-[#4a5568]">◆ Pe PA Agent v1.0.0</div>
              <br />
              <div><span className="text-[#00d4ff]">→</span> <span className="text-[#7a8699]">Coverage fetch ............... </span><span className="text-[#00ff94]">✓ 142ms</span></div>
              <div><span className="text-[#00d4ff]">→</span> <span className="text-[#7a8699]">CRD check .................... </span><span className="text-[#00ff94]">✓ PA required</span></div>
              <div><span className="text-[#00d4ff]">→</span> <span className="text-[#7a8699]">DTR collection ............... </span><span className="text-[#00ff94]">✓ confidence 0.91</span></div>
              <div><span className="text-[#00d4ff]">→</span> <span className="text-[#7a8699]">PAS submission ............... </span><span className="text-[#00ff94]">✓ ref #A2847</span></div>
              <div><span className="text-[#00d4ff]">→</span> <span className="text-[#7a8699]">Decision polling ............. </span><span className="text-[#00ff94]">✓ 4.2s</span></div>
              <br />
              <div><span className="text-[#bd93f9]">status</span><span className="text-[#7a8699]">:    </span><span className="text-[#00ff94]">APPROVED</span></div>
              <div><span className="text-[#bd93f9]">confidence</span><span className="text-[#7a8699]">: </span><span className="text-[#00ff94]">0.94</span></div>
              <div><span className="text-[#bd93f9]">duration</span><span className="text-[#7a8699]">:  </span><span className="text-[#00ff94]">6.8s</span></div>
              <div><span className="text-[#bd93f9]">ref</span><span className="text-[#7a8699]">:       </span><span className="text-[#00ff94]">#A2847-AETNA-2026</span></div>
              <br />
              <div><span className="text-[#00d4ff]">$</span> <span className="text-[#4a5568]">_</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
