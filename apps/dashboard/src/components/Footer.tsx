import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-[#1a1f28] px-10 py-8 flex items-center justify-between">
      <div className="font-mono text-[13px] text-[#7a8699]">
        <span className="text-[#e8edf5] font-medium">Pe</span> — Build healthcare apps without the FHIR headache.
      </div>
      <ul className="flex gap-6 list-none">
        {[
          { label: 'Docs', href: '/docs' },
          { label: 'GitHub', href: 'https://github.com/Evode-Manirahari/2bib' },
          { label: 'Status', href: '/status' },
          { label: 'Privacy', href: '/privacy' },
        ].map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="font-mono text-[12px] text-[#4a5568] no-underline uppercase tracking-wider hover:text-[#00d4ff] transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
