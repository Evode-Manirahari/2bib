'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  lang?: string;
  className?: string;
  maxHeight?: string;
}

export function CodeBlock({ code, lang = 'json', className, maxHeight = '400px' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border bg-muted/30', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="overflow-auto p-4 text-xs font-mono text-foreground"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function JsonBlock({ data, className, maxHeight }: { data: unknown; className?: string; maxHeight?: string }) {
  return (
    <CodeBlock
      code={JSON.stringify(data, null, 2)}
      lang="json"
      className={className}
      maxHeight={maxHeight}
    />
  );
}
