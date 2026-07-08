import { z } from 'zod';

export const adminListUsersQuerySchema = z.object({
  role: z.enum(['patient', 'doctor', 'admin']).optional(),
  is_active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminListAppointmentsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  payment_status: z.enum(['pending', 'succeeded', 'failed', 'refunded']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminListPaymentsQuerySchema = z.object({
  provider: z.enum(['stripe', 'mpesa']).optional(),
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

export const adminUpdateUserRoleSchema = z.object({
  role: z.enum(['patient', 'doctor', 'admin']),
});

export const adminUpdateAppointmentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']),
});

export const adminUpdatePaymentStatusSchema = z.object({
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded']),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;
export type AdminListAppointmentsQuery = z.infer<typeof adminListAppointmentsQuerySchema>;
export type AdminListPaymentsQuery = z.infer<typeof adminListPaymentsQuerySchema>;
export type AdminUpdateUserStatusInput = z.infer<typeof adminUpdateUserStatusSchema>;
export type AdminUpdateUserRoleInput = z.infer<typeof adminUpdateUserRoleSchema>;
export type AdminUpdateAppointmentStatusInput = z.infer<typeof adminUpdateAppointmentStatusSchema>;
export type AdminUpdatePaymentStatusInput = z.infer<typeof adminUpdatePaymentStatusSchema>;
