import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { markPaid } from './payment.service';

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);

// Demo-only "checkout" — no Stripe SDK, no charge. Exists so the app's core
// loop (signup -> pay -> predict) can be tested before step 18 wires up a
// real payment processor.
paymentRoutes.post(
  '/pay',
  asyncHandler(async (req, res) => {
    const user = await markPaid(req.userId!);
    res.json({ user });
  }),
);
