import rateLimit from 'express-rate-limit';

// Keyed by IP (default). Tight enough to blunt brute-forcing/credential
// stuffing on login and signup without punishing normal usage.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});
