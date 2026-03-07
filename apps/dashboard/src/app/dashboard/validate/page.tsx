'use client';

import { useEffect, useState } from 'react';
import { validateResource, fetchProfiles, getStoredApiKey, type ValidationResult, type ValidateProfile } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { Badge } from '@/components/badge';

import { ApiKeyModal } from '@/components/api-key-input';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

const EXAMPLE_RESOURCE = JSON.stringify(
  {
    resourceType: 'Patient',
    id: 'example-001',
    name: [{ family: 'Smith', given: ['Jane'] }],
    gender: 'female',
    birthDate: '1985-04-23',
  },
  null,
  2,
);

export default function ValidatePage() {
  const [showModal, setShowModal] = useState(false);
  const [profiles, setProfiles] = useState<ValidateProfile[]>([]);
  const [resourceText, setResourceText] = useState(EXAMPLE_RESOURCE);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [enrich, setEnrich] = useState(false);
  const [mode, setMode] = useState<'auto' | 'structural' | 'hl7'>('auto');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setShowModal(true); return; }
    fetchProfiles().then((d) => setProfiles(d.profiles)).catch(() => undefined);
  }, []);

  const handleValidate = async () => {
    setParseError('');
    setError('');
    let resource: unknown;
    try {
      resource = JSON.parse(resourceText);
    } catch {
      setParseError('Invalid JSON');
      return;
    }
    setLoading(true);
    try {
      const r = await validateResource(resource, {
        profile: selectedProfile || undefined,
        enrich,
        mode,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showModal && <ApiKeyModal onSave={() => { setShowModal(false); void fetchProfiles().then((d) => setProfiles(d.profiles)).catch(() => undefined); }} />}

      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-foreground">FHIR Validator</h1>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">FHIR Resource (JSON)</label>
              {parseError && <span className="text-xs text-destructive">{parseError}</span>}
            </div>
            <textarea
              className="h-72 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={resourceText}
              onChange={(e) => setResourceText(e.target.value)}
              spellCheck={false}
            />

            {/* Options */}
            <div className="flex flex-wrap gap-3">
              {/* Profile */}
              <div className="flex-1 min-w-[160px]">
                <label className="mb-1 block text-xs text-muted-foreground">Profile</label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (default)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Mode */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="auto">Auto</option>
                  <option value="structural">Structural</option>
                  <option value="hl7">HL7</option>
                </select>
              </div>

              {/* Enrich */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enrich}
                    onChange={(e) => setEnrich(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-muted-foreground">AI enrich</span>
                </label>
              </div>
            </div>

            <button
              onClick={() => void handleValidate()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {loading ? 'Validating…' : 'Validate'}
            </button>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-3">
            {result ? (
              <>
                {/* Summary */}
                <div
                  className={`flex items-center gap-3 rounded-lg border p-4 ${
                    result.isValid
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  {result.isValid ? (
                    <CheckCircle size={20} className="text-green-400 shrink-0" />
                  ) : (
                    <XCircle size={20} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {result.isValid ? 'Valid' : 'Invalid'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.errorCount} error{result.errorCount !== 1 ? 's' : ''} ·{' '}
                      {result.warningCount} warning{result.warningCount !== 1 ? 's' : ''} ·{' '}
                      {formatDuration(result.durationMs)}
                      {result.engine && ` · ${result.engine}`}
                      {result.cached && ' · cached'}
                    </p>
                  </div>
                </div>

                {/* Errors */}
                {result.errors.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className={`rounded-md border p-3 text-xs ${
                          err.severity === 'error' || err.severity === 'fatal'
                            ? 'border-red-500/20 bg-red-500/5'
                            : 'border-yellow-500/20 bg-yellow-500/5'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle
                            size={12}
                            className={`mt-0.5 shrink-0 ${
                              err.severity === 'error' || err.severity === 'fatal'
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-muted-foreground">{err.path}</code>
                              <Badge
                                variant={
                                  err.severity === 'error' || err.severity === 'fatal'
                                    ? 'error'
                                    : 'warning'
                                }
                              >
                                {err.category}
                              </Badge>
                            </div>
                            <p className="text-foreground">{err.message}</p>
                            {err.suggestion && (
                              <p className="text-muted-foreground">💡 {err.suggestion}</p>
                            )}
                            {err.igLink && (
                              <a
                                href={err.igLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline"
                              >
                                IG reference →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Validation results will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
