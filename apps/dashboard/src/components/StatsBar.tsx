const stats = [
  { value: '5', label: 'Payer profiles — UHC, Aetna, Cigna, Anthem, Humana' },
  { value: '513', label: 'Tests passing across 11 packages' },
  { value: '1', label: 'API call to run a full prior auth workflow' },
  { value: '40M', label: 'PA requests per year going digital by 2027' },
];

export default function StatsBar() {
  return (
    <div className="relative z-10 flex border-t border-b border-[#1a1f28] bg-[#0a0c0f]">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex-1 px-8 py-7 border-r border-[#1a1f28] last:border-r-0 flex flex-col gap-1.5"
        >
          <div className="font-mono text-[32px] font-semibold text-[#00d4ff] tracking-[-1px] leading-none">
            {stat.value}
          </div>
          <div className="text-[13px] text-[#7a8699]">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
