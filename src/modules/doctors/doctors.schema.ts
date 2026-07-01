import { z } from 'zod';

// ── Create doctor profile ─────────────────────────────────────────────────────
// Called after a user registers with role 'doctor'
export const createDoctorProfileSchema = z.object({
  specialization: z
    .string()
    .min(3, 'Specialization must be at least 3 characters')
    .trim(),

  license_number: z
    .string()
    .min(4, 'Invalid license number')
    .trim(),

  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').trim().optional(),

  consultation_fee: z
    .number()
    .min(0, 'Consultation fee cannot be negative'),

  years_of_experience: z
    .number()
    .int('Years of experience must be a whole number')
    .min(0, 'Years of experience cannot be negative')
    .default(0),
});

// ── Update doctor profile ─────────────────────────────────────────────────────
// All fields optional — only update what is sent
export const updateDoctorProfileSchema = z.object({
  specialization: z.string().min(3).trim().optional(),
  bio: z.string().max(1000).trim().optional(),
  consultation_fee: z.number().min(0).optional(),
  years_of_experience: z.number().int().min(0).optional(),
});

// ── Create availability slot ──────────────────────────────────────────────────
export const createAvailabilitySlotSchema = z.object({
  day_of_week: z.enum(
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  ),

  start_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format'),

  end_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format'),
})
.refine((data) => data.end_time > data.start_time, {
  message: 'End time must be after start time',
  path: ['end_time'],
});

// ── Bulk create availability slots ────────────────────────────────────────────
// Doctors often set up a whole week of slots at once
export const createAvailabilitySlotsSchema = z.object({
  slots: z
    .array(createAvailabilitySlotSchema)
    .min(1, 'At least one slot is required')
    .max(50, 'Cannot create more than 50 slots at once'),
});

// ── Toggle slot active/inactive ───────────────────────────────────────────────
export const toggleSlotSchema = z.object({
  is_active: z.boolean(),
});

// ── Query params for listing doctors ─────────────────────────────────────────
export const listDoctorsQuerySchema = z.object({
  specialization: z.string().trim().optional(),
  page: z.string().default('1').transform(Number),
  limit: z.string().default('10').transform(Number),
});

// ── Inferred types ────────────────────────────────────────────────────────────
export type CreateDoctorProfileInput = z.infer<typeof createDoctorProfileSchema>;
export type UpdateDoctorProfileInput = z.infer<typeof updateDoctorProfileSchema>;
export type CreateAvailabilitySlotInput = z.infer<typeof createAvailabilitySlotSchema>;
export type CreateAvailabilitySlotsInput = z.infer<typeof createAvailabilitySlotsSchema>;
export type ToggleSlotInput = z.infer<typeof toggleSlotSchema>;
export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;