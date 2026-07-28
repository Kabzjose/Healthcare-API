import { z } from 'zod';

// ── Book appointment (patient) ────────────────────────────────────────────────
export const bookAppointmentSchema = z.object({
  doctor_id: z
    .string({ error: 'Doctor ID is required' })
    .uuid('Doctor ID must be a valid UUID'),

  availability_slot_id: z
    .string({ error: 'Slot ID is required' })
    .uuid('Slot ID must be a valid UUID'),

  appointment_date: z
    .string({ error: 'Appointment date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      (date) => {
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 3);
        minDate.setHours(0, 0, 0, 0);
        return new Date(date) >= minDate;
      },
      { message: 'Appointments must be booked at least 3 days in advance' }
    ),

  reason: z
    .string()
    .min(5, 'Please provide a brief reason for the visit')
    .max(500, 'Reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

// ── Update appointment status (doctor) ────────────────────────────────────────
export const updateAppointmentStatusSchema = z.object({
  status: z
    .string({ error: 'Status is required' })
    .refine((value) => ['confirmed', 'completed', 'no_show'].includes(value), {
      message: 'Status must be one of: confirmed, completed, no_show',
    }),
  notes: z
    .string()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .trim()
    .optional(),
});

// ── Cancel appointment (patient) ──────────────────────────────────────────────
export const cancelAppointmentSchema = z.object({
  reason: z
    .string()
    .max(500, 'Reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

// ── List appointments query params ────────────────────────────────────────────
export const listAppointmentsQuerySchema = z.object({
  status: z
    .enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'])
    .optional(),
  view: z.enum(['upcoming', 'past']).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => {
      const n = Number(val ?? '1');
      return isNaN(n) || n < 1 ? 1 : n;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const n = Number(val ?? '10');
      return isNaN(n) || n < 1 ? 10 : n;
    }),
});

// ── Get doctor appointments query params ─────────────────────────────────────
export const getDoctorAppointmentsQuerySchema = listAppointmentsQuerySchema.extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type GetDoctorAppointmentsQuery = z.infer<typeof getDoctorAppointmentsQuerySchema>;