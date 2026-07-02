import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

// Keyed by IP (default). Tight enough to blunt brute-forcing/credential
// stuffing on login and signup without punishing normal usage. Jest sets
// NODE_ENV=test automatically, so integration tests that exercise many
// signup/login cases in one file don't trip this — the limit itself is only
// ever loosened for that, never for a real deployment.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});
