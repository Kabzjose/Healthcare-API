import { Request, Response } from 'express';
import * as paymentsService from './payments.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthenticatedRequest } from '../../types';
import { CreateCheckoutSessionInput, ListPaymentsQuery } from './payments.schema';
import { InitiateMpesaInput } from './payments.schema';
import { MpesaCallbackPayload } from '../../integrations/mpesa/mpesa.service';


// ── POST /payments/checkout ───────────────────────────────────────────────────
// Patient initiates payment for an appointment
export const createCheckoutSession = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await paymentsService.createCheckoutSession(
      req.user.userId,
      req.body as CreateCheckoutSessionInput
    );
    return ApiResponse.created(res, 'Checkout session created', result);
  }
);

// ── POST /payments/webhook ────────────────────────────────────────────────────
// Stripe calls this endpoint — NOT called by your frontend
// Needs raw body (not parsed JSON) for signature verification
export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).json({ success: false, message: 'Missing Stripe signature' });
    return;
  }

  // req.body here is a raw Buffer — set by express.raw() middleware on this route
  await paymentsService.handleStripeWebhook(req.body as Buffer, signature);

  // Stripe expects a 200 response quickly — it retries if you take too long
  res.status(200).json({ received: true });
});

// ── GET /payments/my ──────────────────────────────────────────────────────────
// Patient views their payment history
export const getMyPayments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await paymentsService.getPatientPayments(
      req.user.userId,
      req.query as unknown as ListPaymentsQuery
    );
    return ApiResponse.ok(res, 'Payments fetched', result.data, result.meta as Record<string, unknown>);
  }
);
// ── POST /payments/mpesa/initiate ─────────────────────────────────────────────
export const initiateMpesa = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await paymentsService.initiateMpesaPayment(
      req.user.userId,
      req.body as InitiateMpesaInput
    );
    return ApiResponse.ok(res, result.message, { checkoutRequestId: result.checkoutRequestId });
  }
);

// ── POST /payments/mpesa/callback ─────────────────────────────────────────────
// Safaricom calls this — NOT your frontend
export const mpesaCallback = asyncHandler(async (req: Request, res: Response) => {
  await paymentsService.handleMpesaCallback(req.body as MpesaCallbackPayload);
  // Safaricom expects a specific response shape
  res.status(200).json({
    ResultCode: 0,
    ResultDesc: 'Accepted',
  });
});
