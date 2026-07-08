import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import * as stripePaymentsService from './stripe.service';
import { CreateCheckoutSessionInput } from './payments.schema';

export const createCheckoutSession = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await stripePaymentsService.createCheckoutSession(
      req.user.userId,
      req.body as CreateCheckoutSessionInput
    );
    return ApiResponse.created(res, 'Checkout session created', result);
  }
);

export const stripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).json({ success: false, message: 'Missing Stripe signature' });
    return;
  }

  await stripePaymentsService.handleStripeWebhook(req.body as Buffer, signature);
  res.status(200).json({ received: true });
});
