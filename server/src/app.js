import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import ticketRoutes from './routes/tickets.js';
import knowledgeRoutes from './routes/knowledge.js';
import reportRoutes from './routes/reports.js';

export function createApp() {
  const app = express();

  // Render/Railway sit behind one proxy; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.clientUrls,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/knowledge-articles', knowledgeRoutes);
  app.use('/api/reports', reportRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
