import type { HttpClient } from '../http';
import type { FhirSearchResponse } from '../types';

export class FhirClient {
  constructor(private readonly http: HttpClient) {}

  search(resourceType: string, params: Record<string, string | number> = {}): Promise<FhirSearchResponse> {
    const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    const qs = q.toString() ? `?${q}` : '';
    return this.http.get<FhirSearchResponse>(`/fhir/${resourceType}${qs}`);
  }

  read(resourceType: string, id: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/fhir/${resourceType}/${id}`);
  }

  create(resource: Record<string, unknown>): Promise<Record<string, unknown>> {
    const rt = resource['resourceType'] as string;
    return this.http.post<Record<string, unknown>>(`/fhir/${rt}`, resource);
  }

  update(resource: Record<string, unknown>): Promise<Record<string, unknown>> {
    const rt = resource['resourceType'] as string;
    const id = resource['id'] as string;
    return this.http.put<Record<string, unknown>>(`/fhir/${rt}/${id}`, resource);
  }

  transaction(bundle: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>('/fhir/Bundle', bundle);
  }
}
