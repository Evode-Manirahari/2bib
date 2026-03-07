'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchWorkflowTemplates,
  fetchWorkflowTemplate,
  runWorkflow,
  fetchWorkflowRuns,
  getStoredApiKey,
  type WorkflowTemplate,
  type WorkflowRun,
} from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';
import { RunStatusBadge, StepStatusBadge } from '@/components/badge';
import { ApiKeyModal } from '@/components/api-key-input';

import { Play, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

export default function WorkflowsPage() {
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<Array<{ name: string; description: string; file: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateDetail, setTemplateDetail] = useState<WorkflowTemplate | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);
  const [expandedSteps, setExpandedSteps] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const data = await fetchWorkflowRuns({ pageSize: 10 });
      setRuns(data.data);
      setTotalRuns(data.total);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key) { setShowModal(true); return; }
    setLoading(true);
    Promise.all([
      fetchWorkflowTemplates().then((d) => {
        setTemplates(d.templates);
        if (d.templates.length > 0) setSelectedTemplate(d.templates[0]!.name);
      }),
      loadRuns(),
    ]).finally(() => setLoading(false));
  }, [loadRuns]);

  // Load template detail when selection changes
  useEffect(() => {
    if (!selectedTemplate) return;
    fetchWorkflowTemplate(selectedTemplate)
      .then((d) => setTemplateDetail(d.template))
      .catch(() => setTemplateDetail(null));
  }, [selectedTemplate]);

  const handleRun = async () => {
    if (!selectedTemplate) return;
    setRunning(true);
    setError('');
    setActiveRun(null);
    try {
      const result = await runWorkflow(selectedTemplate);
      setActiveRun(result);
      void loadRuns();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      {showModal && <ApiKeyModal onSave={() => { setShowModal(false); void loadRuns(); }} />}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Workflow Runner</h1>
          <button
            onClick={() => void loadRuns()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Template picker */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-medium text-foreground">Templates</h2>

              <div className="space-y-1">
                {loading ? (
                  <p className="text-xs text-muted-foreground">Loading templates…</p>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No templates found in data/workflows/</p>
                ) : (
                  templates.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => setSelectedTemplate(tpl.name)}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                        selectedTemplate === tpl.name
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <p className="font-medium text-foreground">{tpl.name}</p>
                      {tpl.description && (
                        <p className="mt-0.5 text-muted-foreground line-clamp-2">{tpl.description}</p>
                      )}
                    </button>
                  ))
                )}
              </div>

              {templateDetail && (
                <div className="border-t border-border pt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Steps:</p>
                  {templateDetail.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span className="font-mono text-foreground">{s.name}</span>
                      <span className="text-muted-foreground">({s.action})</span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <button
                onClick={() => void handleRun()}
                disabled={running || !selectedTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                <Play size={13} />
                {running ? 'Running…' : 'Run Workflow'}
              </button>
            </div>
          </div>

          {/* Run results + history */}
          <div className="space-y-4">
            {/* Active run result */}
            {activeRun && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">{activeRun.workflowName}</h2>
                  <div className="flex items-center gap-2">
                    <RunStatusBadge status={activeRun.status} />
                    {activeRun.durationMs != null && (
                      <span className="text-xs text-muted-foreground">{formatDuration(activeRun.durationMs)}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedSteps((e) => !e)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {expandedSteps ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {activeRun.steps.length} step{activeRun.steps.length !== 1 ? 's' : ''}
                </button>

                {expandedSteps && (
                  <div className="space-y-2">
                    {activeRun.steps.map((step, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-md border border-border p-3 text-xs"
                      >
                        <StepStatusBadge status={step.status} />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{step.name}</span>
                            <span className="text-muted-foreground">({step.action})</span>
                            <span className="ml-auto text-muted-foreground">
                              {formatDuration(step.durationMs)}
                            </span>
                          </div>
                          {step.error && (
                            <p className="text-destructive">{step.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Run history */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">
                  Run History
                  <span className="ml-2 text-xs text-muted-foreground">({totalRuns} total)</span>
                </h2>
              </div>

              {runs.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No runs yet. Select a template and click Run.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {runs.map((run) => (
                    <div key={run.id} className="flex items-center gap-3 px-4 py-2.5">
                      <RunStatusBadge status={run.status} />
                      <span className="flex-1 text-xs text-foreground">{run.workflowName}</span>
                      <span className="text-xs text-muted-foreground">
                        {run.durationMs != null ? formatDuration(run.durationMs) : '—'}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
