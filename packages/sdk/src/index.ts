export { PeClient } from './client';
export { PeApiError } from './http';
export * from './types';
export type { ValidateOptions } from './resources/validate';
export type { SubmitPAOptions } from './resources/pa';
export type { RunWorkflowOptions } from './resources/workflows';

import { PeClient } from './client';
import type { PeClientOptions } from './types';

export function createClient(opts: PeClientOptions): PeClient {
  return new PeClient(opts);
}
