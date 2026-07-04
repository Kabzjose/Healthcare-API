import { Router } from 'express';
import express from 'express';
import * as paymentsController from './payments.controllers';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import {
  createCheckoutSessionSchema,
  listPaymentsQuerySchema,
} from './payments.schema';


export const router: Router = Router();

// ── CRITICAL: Stripe webhook must receive the raw body ────────────────────────
// express.json() parses the body into an object which breaks Stripe's
// signature verification. This route must use express.raw() instead.
// It must be registered BEFORE any body-parsing middleware on this router.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.stripeWebhook
);

// ── Patient routes ────────────────────────────────────────────────────────────

// Initiate payment for an appointment
router.post(
  '/checkout',
  authenticate,
  authorize('patient'),
  validate(createCheckoutSessionSchema),
  paymentsController.createCheckoutSession
);

// View payment history
router.get(
  '/my',
  authenticate,
  authorize('patient'),
  validateQuery(listPaymentsQuerySchema),
  paymentsController.getMyPayments
);

export default router;