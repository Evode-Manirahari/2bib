export default function ComplianceBar() {
  const items = [
    'Da Vinci CRD / DTR / PAS',
    'US Core 6.1.0',
    'SMART on FHIR 2.0',
    'CMS-0057 Ready',
    'HL7 FHIR R4',
  ];

  return (
    <div className="relative z-10 bg-[rgba(0,212,255,0.04)] border-t border-b border-[rgba(0,212,255,0.15)] px-10 py-3.5 flex items-center justify-center gap-10">
      {items.map((item) => (
        <div key={item} className="font-mono text-[11px] text-[#00d4ff] uppercase tracking-widest flex items-center gap-2">
          <span className="text-[10px]">✓</span>
          {item}
        </div>
      ))}
    </div>
  );
}
