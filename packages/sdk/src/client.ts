import { HttpClient } from './http';
import { FhirClient } from './resources/fhir';
import { ValidateClient } from './resources/validate';
import { PAClient } from './resources/pa';
import { WorkflowsClient } from './resources/workflows';
import type { PeClientOptions, ApiKeyInfo, LogsResponse } from './types';

export class PeClient {
  readonly fhir: FhirClient;
  readonly validate: ValidateClient;
  readonly pa: PAClient;
  readonly workflows: WorkflowsClient;

  private readonly http: HttpClient;

  constructor(opts: PeClientOptions) {
    if (!opts.apiKey) throw new Error('apiKey is required');
    this.http = new HttpClient(opts);
    this.fhir = new FhirClient(this.http);
    this.validate = new ValidateClient(this.http);
    this.pa = new PAClient(this.http);
    this.workflows = new WorkflowsClient(this.http);
  }

  me(): Promise<ApiKeyInfo> {
    return this.http.get<ApiKeyInfo>('/me');
  }

  logs(params: { page?: number; pageSize?: number; method?: string; minStatus?: number; maxStatus?: number } = {}): Promise<LogsResponse> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.method) q.set('method', params.method);
    if (params.minStatus) q.set('minStatus', String(params.minStatus));
    if (params.maxStatus) q.set('maxStatus', String(params.maxStatus));
    const qs = q.toString() ? `?${q}` : '';
    return this.http.get<LogsResponse>(`/logs${qs}`);
  }
}
