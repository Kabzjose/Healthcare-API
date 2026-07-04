import Stripe from 'stripe';
import { env } from '../../config/env';



// Explicitly type the client and update the API version
export const stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-06-24.dahlia', 
});
