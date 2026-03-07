import 'dotenv/config';
import app from './app';

const PORT = parseInt(process.env.PORT ?? process.env.PROXY_PORT ?? '3002', 10);

const server = app.listen(PORT, () => {
  console.log(`[pe:proxy] Server running on http://localhost:${PORT}`);
  console.log(`[pe:proxy] Health: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default server;
