import { z } from 'zod';

// ── Create a Stripe checkout session ─────────────────────────────────────────
export const createCheckoutSessionSchema = z.object({
  appointment_id: z
    .string({ error: 'Appointment ID is required' })
    .uuid('Appointment ID must be a valid UUID'),
});

// ── Stripe webhook — raw body needed for signature verification ───────────────
// No Zod schema here — Stripe webhooks are verified differently (see service)

// ── List payments query ───────────────────────────────────────────────────────
export const listPaymentsQuerySchema = z.object({
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded']).optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('10').transform(Number),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;