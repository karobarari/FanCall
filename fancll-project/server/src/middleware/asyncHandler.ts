import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Forwards rejected promises to the error middleware instead of hanging.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);
