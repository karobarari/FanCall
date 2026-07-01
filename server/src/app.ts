import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { fixturesRoutes } from './modules/fixtures/fixtures.routes';
import { predictionsRoutes } from './modules/predictions/predictions.routes';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes';
import { notFound, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.use(helmet());
  // credentials: true is required for the session cookie to flow to the frontend.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/fixtures', fixturesRoutes);
  app.use('/api/predictions', predictionsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
