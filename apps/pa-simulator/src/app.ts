import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { paRouter } from './routes';
import { errorHandler } from './middleware';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'pa-simulator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/pa', paRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

app.use(errorHandler);

export default app;
