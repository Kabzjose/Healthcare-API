import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Define the shape and validation rules for every env variable
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  API_VERSION: z.string().default('v1'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  DATABASE_POOL_MIN: z.string().default('2').transform(Number),
  DATABASE_POOL_MAX: z.string().default('10').transform(Number),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000').transform((val) => val.split(',')),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  // Google Calendar
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Africa's Talking
  AT_API_KEY: z.string().optional(),
  AT_USERNAME: z.string().default('sandbox'),
  AT_SENDER_ID: z.string().default('HEALTH'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // M-Pesa
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
});

// Parse and validate — throws a clear error at startup if anything is missing/wrong
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1); // Stop the app — it cannot run safely without valid config
}

export const env = parsed.data;
export type Env = typeof env;