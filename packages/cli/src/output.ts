// ── CLI Output Helpers ────────────────────────────────────────────────────────

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }
  const keys = Object.keys(rows[0]!);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i]!)).join('  ');
  const divider = widths.map((w) => '─'.repeat(w)).join('  ');
  console.log(header);
  console.log(divider);
  for (const row of rows) {
    console.log(keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i]!)).join('  '));
  }
}

export function printError(message: string, jsonMode = false): void {
  if (jsonMode) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
}

export function printSuccess(message: string, jsonMode = false): void {
  if (jsonMode) {
    console.log(JSON.stringify({ message }));
  } else {
    console.log(message);
  }
}
