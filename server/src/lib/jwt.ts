import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
  return payload.sub;
}
