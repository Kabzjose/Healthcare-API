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

// ── Initiate M-Pesa STK push ─────────────────────────────────────────────────
export const initiateMpesaSchema = z.object({
  appointment_id: z
    .string({ error: 'Appointment ID is required' })
    .uuid('Appointment ID must be a valid UUID'),

  phone: z
    .string({ error: 'Phone number is required' })
    .regex(
      /^(254|0)[17]\d{8}$/,
      'Phone must be a valid Kenyan number e.g. 254712345678 or 0712345678'
    )
    .transform((phone) =>
      // Normalise to 254 format
      phone.startsWith('0') ? `254${phone.slice(1)}` : phone
    ),
});

export type InitiateMpesaInput = z.infer<typeof initiateMpesaSchema>;

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;