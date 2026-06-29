import { z } from 'zod';

// ── Register ──────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email address')
    .toLowerCase()
    .trim(),

  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  first_name: z
    .string({ error: 'First name is required' })
    .min(2, 'First name must be at least 2 characters')
    .trim(),

  last_name: z
    .string({ error: 'Last name is required' })
    .min(2, 'Last name must be at least 2 characters')
    .trim(),

  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number')
    .optional(),

  role: z.enum(['patient', 'doctor']).default('patient'),
  // Note: 'admin' role cannot be self-assigned — only set via DB or admin panel
});

// ── Login ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string({ error: 'Email is required' }).email().toLowerCase().trim(),
  password: z.string({ error: 'Password is required' }),
});

// ── Refresh token ─────────────────────────────────────────────────────────────
export const refreshTokenSchema = z.object({
  refresh_token: z.string({ error: 'Refresh token is required' }),
});

// ── Change password ───────────────────────────────────────────────────────────
export const changePasswordSchema = z
  .object({
    current_password: z.string({ error: 'Current password is required' }),
    new_password: z
      .string({ error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirm_password: z.string({ error: 'Please confirm your new password' }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'], // points to the field that has the error
  });

// ── Inferred TypeScript types from schemas ────────────────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
