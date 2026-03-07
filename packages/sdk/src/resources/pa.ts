import type { HttpClient } from '../http';
import type { PASimulation, PayerProfile } from '../types';

export interface SubmitPAOptions {
  payerId: string;
  patientRef?: string;
  icd10?: string;
  cptCode?: string;
  scenario?: string;
}

export class PAClient {
  constructor(private readonly http: HttpClient) {}

  payers(): Promise<{ payers: PayerProfile[] }> {
    return this.http.get('/pa/payers');
  }

  submit(opts: SubmitPAOptions): Promise<PASimulation> {
    return this.http.post<PASimulation>('/pa/submit', opts);
  }

  get(id: string): Promise<PASimulation> {
    return this.http.get<PASimulation>(`/pa/${id}`);
  }

  submitInfo(id: string, additionalInfo: string): Promise<PASimulation> {
    return this.http.post<PASimulation>(`/pa/${id}/info`, { additionalInfo });
  }

  appeal(id: string, reason: string, scenario?: string): Promise<PASimulation> {
    return this.http.post<PASimulation>(`/pa/${id}/appeal`, { reason, ...(scenario ? { scenario } : {}) });
  }

  timeline(id: string): Promise<{ id: string; currentStatus: string; timeline: PASimulation['timeline']; total: number }> {
    return this.http.get(`/pa/${id}/timeline`);
  }
}
