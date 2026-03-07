import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env['PORT'] ?? process.env['PA_SIMULATOR_PORT'] ?? '3003', 10);

const server = app.listen(PORT, () => {
  console.log(`[pe:pa-simulator] Server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
