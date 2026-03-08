// ── CLI Config Store ──────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface PeConfig {
  apiKey?: string;
  baseUrl?: string;
  email?: string;
  plan?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.pe');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function readConfig(): PeConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as PeConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: PeConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiKey(override?: string): string | undefined {
  return override ?? process.env['PE_API_KEY'] ?? readConfig().apiKey;
}

export function getBaseUrl(override?: string): string {
  return override ?? process.env['PE_BASE_URL'] ?? readConfig().baseUrl ?? 'https://api.getpe.dev';
}
