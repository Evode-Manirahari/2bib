'use client';
import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-10 h-14 bg-[rgba(5,6,8,0.85)] backdrop-blur-md border-b border-[#1a1f28]">
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <div className="w-7 h-7 bg-[#00d4ff] rounded-md flex items-center justify-center text-black text-xs font-semibold font-mono">
          Pe
        </div>
        <span className="font-mono text-lg font-semibold text-[#e8edf5] tracking-tight">Pe</span>
      </Link>

      <ul className="flex items-center gap-8 list-none">
        {[
          { label: 'Features', href: '#features' },
          { label: 'PA Agent', href: '#agent' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Docs', href: '/docs' },
        ].map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="font-mono text-xs text-[#7a8699] uppercase tracking-widest no-underline hover:text-[#00d4ff] transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/get-started"
            className="font-mono text-xs font-medium text-black bg-[#00d4ff] px-4 py-1.5 rounded uppercase tracking-widest no-underline hover:opacity-85 transition-opacity"
          >
            Get API Key
          </Link>
        </li>
      </ul>
    </nav>
  );
}
