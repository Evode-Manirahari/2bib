import type { HttpClient } from '../http';
import type { WorkflowRun, WorkflowTemplate, WorkflowTemplateInfo, WorkflowRunsResponse } from '../types';

export interface RunWorkflowOptions {
  templateName?: string;
  template?: WorkflowTemplate;
  vars?: Record<string, unknown>;
}

export class WorkflowsClient {
  constructor(private readonly http: HttpClient) {}

  templates(): Promise<{ templates: WorkflowTemplateInfo[] }> {
    return this.http.get('/workflows/templates');
  }

  template(name: string): Promise<{ template: WorkflowTemplate }> {
    return this.http.get(`/workflows/templates/${name}`);
  }

  run(opts: RunWorkflowOptions): Promise<WorkflowRun> {
    return this.http.post<WorkflowRun>('/workflows/run', opts);
  }

  list(params: { page?: number; pageSize?: number } = {}): Promise<WorkflowRunsResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString() ? `?${q}` : '';
    return this.http.get(`/workflows${qs}`);
  }

  get(id: string): Promise<WorkflowRun> {
    return this.http.get(`/workflows/${id}`);
  }
}
