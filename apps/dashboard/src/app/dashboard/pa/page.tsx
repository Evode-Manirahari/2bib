'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchPayers, submitPA, fetchPA, getStoredApiKey, type PASimulation, type PayerProfile } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PAStatusBadge } from '@/components/badge';
import { ApiKeyModal } from '@/components/api-key-input';
import { Send, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const SCENARIOS = [
  { value: '', label: 'Random (based on payer profile)' },
  { value: 'auto-approve', label: 'Auto-approve' },
  { value: 'auto-deny', label: 'Auto-deny' },
  { value: 'pended', label: 'Pend for info → Approve' },
  { value: 'appeal-approve', label: 'Deny → Appeal Approve' },
  { value: 'peer-to-peer', label: 'Peer-to-peer review' },
];

export default function PAPage() {
  const [showModal, setShowModal] = useState(false);
  const [payers, setPayers] = useState<PayerProfile[]>([]);
  const [payerId, setPayerId] = useState('');
  const [patientRef, setPatientRef] = useState('Patient/sandbox-001');
  const [icd10, setIcd10] = useState('C34.10');
  const [cptCode, setCptCode] = useState('77067');
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simulation, setSimulation] = useState<PASimulation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setShowModal(true); return; }
    fetchPayers().then((d) => {
      setPayers(d.payers);
      if (d.payers.length > 0) setPayerId(d.payers[0]!.id);
    }).catch(() => undefined);
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const sim = await submitPA({ payerId, patientRef, icd10, cptCode, scenario: scenario || undefined });
      setSimulation(sim);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!simulation) return;
    setRefreshing(true);
    try {
      const updated = await fetchPA(simulation.id);
      setSimulation(updated);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [simulation]);

  const selectedPayer = payers.find((p) => p.id === payerId);

  return (
    <>
      {showModal && <ApiKeyModal onSave={() => { setShowModal(false); void fetchPayers().then((d) => { setPayers(d.payers); if (d.payers.length > 0) setPayerId(d.payers[0]!.id); }).catch(() => undefined); }} />}

      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-foreground">PA Simulator</h1>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Submission form */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-medium text-foreground">Submit Prior Authorization</h2>

            <div className="space-y-3">
              {/* Payer */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Payer</label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedPayer && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-approve rate: {Math.round(selectedPayer.autoApproveRate * 100)}%
                  </p>
                )}
              </div>

              {/* Patient ref */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Patient Reference</label>
                <input
                  value={patientRef}
                  onChange={(e) => setPatientRef(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Patient/xxx"
                />
              </div>

              {/* ICD-10 + CPT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">ICD-10 Code</label>
                  <input
                    value={icd10}
                    onChange={(e) => setIcd10(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="C34.10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">CPT Code</label>
                  <input
                    value={cptCode}
                    onChange={(e) => setCptCode(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="77067"
                  />
                </div>
              </div>

              {/* Scenario */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Test Scenario</label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={loading || !payerId}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <Send size={14} />
              {loading ? 'Submitting…' : 'Submit PA Request'}
            </button>
          </div>

          {/* Simulation results */}
          <div className="space-y-4">
            {simulation ? (
              <>
                {/* Status header */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Simulation ID</p>
                      <p className="font-mono text-xs text-foreground">{simulation.id}</p>
                    </div>
                    <button
                      onClick={() => void handleRefresh()}
                      disabled={refreshing}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    >
                      <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <PAStatusBadge status={simulation.currentStatus} />
                    <span className="text-xs text-muted-foreground">{simulation.payerProfile}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-lg border border-border bg-card">
                  <button
                    onClick={() => setTimelineExpanded((e) => !e)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                  >
                    Timeline ({simulation.timeline?.length ?? 0} events)
                    {timelineExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {timelineExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      <div className="space-y-3">
                        {(simulation.timeline ?? []).map((event, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            <div>
                              <PAStatusBadge status={event.status} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(event.timestamp)}
                              </p>
                              {event.note && (
                                <p className="text-xs text-muted-foreground">{event.note}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Submit a PA request to see the simulation
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
