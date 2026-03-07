'use client';

import { useState } from 'react';
import { setStoredApiKey } from '@/lib/api';
import { Key } from 'lucide-react';

interface ApiKeyInputProps {
  onSave: (key: string) => void;
}

export function ApiKeyModal({ onSave }: ApiKeyInputProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('pe_')) {
      setError('API key must start with "pe_"');
      return;
    }
    setStoredApiKey(trimmed);
    onSave(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <Key size={18} className="text-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Enter your API key</h2>
            <p className="text-xs text-muted-foreground">
              Your key is stored locally and never sent to our servers.
            </p>
          </div>
        </div>

        <input
          type="password"
          placeholder="pe_live_..."
          value={key}
          onChange={(e) => { setKey(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Save key
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Don&apos;t have a key? Generate one in your project settings or use the seed script.
        </p>
      </div>
    </div>
  );
}
