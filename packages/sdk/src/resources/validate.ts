import type { HttpClient } from '../http';
import type { ValidationResult, FixResult, ValidateProfile } from '../types';

export interface ValidateOptions {
  profile?: string;
  enrich?: boolean;
  mode?: 'auto' | 'structural' | 'hl7';
}

export class ValidateClient {
  constructor(private readonly http: HttpClient) {}

  validate(resource: Record<string, unknown>, opts: ValidateOptions = {}): Promise<ValidationResult> {
    return this.http.post<ValidationResult>('/validate', { resource, ...opts });
  }

  fix(resource: Record<string, unknown>, errors?: unknown[]): Promise<FixResult> {
    return this.http.post<FixResult>('/validate/fix', { resource, ...(errors ? { errors } : {}) });
  }

  profiles(): Promise<{ profiles: ValidateProfile[] }> {
    return this.http.get('/validate/profiles');
  }
}
