import axios, { type AxiosInstance } from 'axios';

let _client: AxiosInstance | undefined;

export function getHapiClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: process.env.HAPI_FHIR_URL ?? 'http://localhost:8080',
      timeout: 30_000,
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });
  }
  return _client;
}

export function _resetHapiClient(): void {
  _client = undefined;
}
