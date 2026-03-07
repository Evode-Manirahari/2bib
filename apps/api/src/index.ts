import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);

const server = app.listen(PORT, () => {
  console.log(`[pe:api] Server running on http://localhost:${PORT}`);
  console.log(`[pe:api] Health: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  console.log('[pe:api] SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

export default server;
