import dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

// Validate the environment once, at startup, so a misconfig fails loudly
// here instead of surfacing as a confusing runtime error later.
const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be a long random string'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
