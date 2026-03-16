import { Resend } from 'resend';

const resend = process.env['RESEND_API_KEY'] ? new Resend(process.env['RESEND_API_KEY']) : null;

const FROM = 'Pe <hello@getpe.dev>';

export async function sendWelcomeEmail(to: string, keyPrefix: string): Promise<void> {
  if (!resend) return; // Silently skip if not configured

  const curlExample = `curl -H "Authorization: Bearer ${keyPrefix}..." \\
  https://api.getpe.dev/v1/fhir/Patient?family=Smith`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Pe API key is ready',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'IBM Plex Mono', monospace, sans-serif; background:#050608; color:#e8edf5; padding:40px 20px; max-width:560px; margin:0 auto;">
  <div style="margin-bottom:32px;">
    <span style="font-size:20px; font-weight:600; letter-spacing:-0.5px;">Pe</span>
    <span style="margin-left:8px; font-size:10px; color:#4a5568; text-transform:uppercase; letter-spacing:2px;">FHIR API Platform</span>
  </div>

  <h1 style="font-size:24px; font-weight:600; letter-spacing:-1px; margin-bottom:8px;">Your API key is active.</h1>
  <p style="font-size:14px; color:#7a8699; line-height:1.7; margin-bottom:24px;">
    Free tier: 1,000 API calls/day · FHIR Proxy · Validator · PA Simulator
  </p>

  <div style="background:#0a0c0f; border:1px solid #1a1f28; border-radius:8px; padding:16px; margin-bottom:24px;">
    <p style="font-size:11px; color:#4a5568; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px 0;">Key prefix</p>
    <code style="font-size:14px; color:#00d4ff;">${keyPrefix}...</code>
  </div>

  <h2 style="font-size:14px; font-weight:600; margin-bottom:8px;">Make your first request</h2>
  <div style="background:#0a0c0f; border:1px solid #1a1f28; border-radius:8px; padding:16px; margin-bottom:24px;">
    <pre style="font-size:12px; color:#c8d6e5; margin:0; overflow-x:auto;">${curlExample}</pre>
  </div>

  <p style="font-size:13px; color:#7a8699; margin-bottom:24px;">
    The sandbox has 10 pre-seeded patients with real clinical data — try searching by <code style="color:#e8edf5;">family=Smith</code> or <code style="color:#e8edf5;">family=Wilson</code>.
  </p>

  <div style="margin-bottom:24px;">
    <a href="https://getpe.dev/dashboard" style="display:inline-block; background:#00d4ff; color:#050608; font-size:12px; font-weight:600; padding:12px 24px; border-radius:4px; text-decoration:none; text-transform:uppercase; letter-spacing:1px;">Open Dashboard →</a>
  </div>

  <p style="font-size:12px; color:#4a5568; line-height:1.7;">
    Questions or feedback? Reply to this email — I read every one.<br>
    — the Pe team
  </p>
</body>
</html>
    `.trim(),
  });
}
