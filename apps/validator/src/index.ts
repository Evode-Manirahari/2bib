import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env['PORT'] ?? process.env['VALIDATOR_PORT'] ?? '3010', 10);

const server = app.listen(PORT, () => {
  console.log(`[pe:validator] Server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
