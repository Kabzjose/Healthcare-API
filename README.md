# Healthcare Appointment System

Healthcare Appointment System is a TypeScript and Express backend for a medical booking platform. It supports patient registration, doctor profiles, appointment scheduling, payment processing through Stripe and M-Pesa, automated reminders, and admin moderation controls.

The application is built as a modular REST API with PostgreSQL as the primary data store. It validates requests with Zod, uses JWT authentication, and integrates with third-party services for payments, SMS notifications, and Google Calendar.

## What It Does

The system is designed to manage the full appointment lifecycle:

- Patients can register, log in, browse doctors, book appointments, cancel within policy limits, and view their appointments and payment history.
- Doctors can create and manage their profiles, define availability, view appointments, and update appointment status.
- Payments are supported through Stripe checkout and M-Pesa STK push flows, with webhook and callback handling to keep payment states in sync.
- Admin users can review users, appointments, and payments, update statuses, and manage platform-wide access.
- A scheduler sends daily appointment reminder jobs.

## Core Features

- JWT-based authentication and role-based authorization.
- Patient, doctor, and admin roles.
- Appointment booking with slot validation and double-booking protection.
- Stripe checkout session creation and webhook processing.
- M-Pesa payment initiation and Safaricom callback processing.
- SMS notifications through Africa's Talking.
- Google Calendar integration support.
- PostgreSQL migrations for schema management.
- Centralized error handling, request validation, and logging.

## Tech Stack

- Node.js
- Express 5
- TypeScript
- PostgreSQL
- Zod
- JWT
- Winston

## Project Structure

- `src/app.ts` - Express app setup, middleware, and route mounting.
- `src/server.ts` - Server bootstrap, database check, scheduler startup, graceful shutdown.
- `src/config` - Environment loading and logging configuration.
- `src/database` - PostgreSQL connection and migrations.
- `src/modules/auth` - Register, login, refresh token, profile, and password management.
- `src/modules/doctors` - Doctor profile and availability management.
- `src/modules/appointments` - Appointment booking, cancellation, and status updates.
- `src/modules/payments` - Stripe, M-Pesa, and payment history flows.
- `src/modules/admin` - Admin dashboard and moderation endpoints.
- `src/integrations` - External service clients for payments, SMS, and Google Calendar.
- `src/middleware` - Authentication, authorization, validation, and error handling.

## API Overview

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/change-password`

### Doctors

- `GET /doctors`
- `GET /doctors/:profileId`
- `GET /doctors/:profileId/availability`
- `POST /doctors/profile`
- `GET /doctors/profile/me`
- `PATCH /doctors/profile`
- `POST /doctors/availability`
- `GET /doctors/availability/me`
- `PATCH /doctors/availability/:slotId`
- `DELETE /doctors/availability/:slotId`

### Appointments

- `POST /appointments`
- `POST /appointments/:id/cancel`
- `PATCH /appointments/:id/status`
- `GET /appointments`
- `GET /appointments/:id`

### Payments

- `POST /payments/checkout`
- `GET /payments/my`
- `POST /payments/webhook`
- `POST /payments/mpesa/initiate`
- `POST /payments/mpesa/callback`

### Admin

- `GET /admin/dashboard`
- `GET /admin/users`
- `PATCH /admin/users/:userId/status`
- `PATCH /admin/users/:userId/role`
- `GET /admin/appointments`
- `PATCH /admin/appointments/:appointmentId/status`
- `GET /admin/payments`
- `PATCH /admin/payments/:paymentId/status`

## Dependencies

### Runtime Dependencies

- `express` - HTTP server and routing.
- `cors` - Cross-origin request support.
- `helmet` - Secure HTTP headers.
- `express-rate-limit` - Request throttling for abuse protection.
- `dotenv` - Environment variable loading.
- `pg` - PostgreSQL client.
- `jsonwebtoken` - Access and refresh token signing and verification.
- `bcryptjs` - Password hashing and verification.
- `zod` - Request schema validation.
- `winston` - Structured logging.
- `stripe` - Stripe API client.
- `africastalking` - Africa's Talking SMS integration.
- `googleapis` - Google Calendar and Google API integration.
- `@google-cloud/local-auth` - Local Google auth flow support.
- `axios` - HTTP client for provider APIs.
- `node-cron` - Scheduled reminder jobs.
- `uuid` - UUID utilities.

### Development Dependencies

- `typescript` - TypeScript compiler.
- `tsx` - Fast TypeScript execution for development.
- `node-pg-migrate` - Database migration runner.
- `eslint` and `@typescript-eslint/*` - Linting.
- `prettier` - Code formatting.
- `@types/*` packages - TypeScript type definitions for third-party libraries.

## Environment Variables

Create a `.env` file with the following values:

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `PORT` | No | Port to run the API on |
| `API_VERSION` | No | API version prefix |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | No | Minimum pool connections |
| `DATABASE_POOL_MAX` | No | Maximum pool connections |
| `JWT_SECRET` | Yes | Access token signing secret |
| `JWT_EXPIRES_IN` | No | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token lifetime |
| `CLIENT_URL` | No | Frontend origin for CORS |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | No | Rate limit ceiling |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | Google OAuth redirect URI |
| `AT_API_KEY` | No | Africa's Talking API key |
| `AT_USERNAME` | No | Africa's Talking username |
| `AT_SENDER_ID` | No | SMS sender ID |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `STRIPE_CURRENCY` | No | Default Stripe currency, usually `kes` |
| `STRIPE_SUCCESS_URL` | Yes | Frontend success redirect URL |
| `STRIPE_CANCEL_URL` | Yes | Frontend cancel redirect URL |
| `MPESA_CONSUMER_KEY` | No | M-Pesa API key |
| `MPESA_CONSUMER_SECRET` | No | M-Pesa API secret |
| `MPESA_PASSKEY` | No | M-Pesa passkey |
| `MPESA_SHORTCODE` | No | Paybill or shortcode |
| `MPESA_CALLBACK_URL` | No | Public callback URL |
| `MPESA_ENV` | No | `sandbox` or `production` |
| `APP_URL` | No | Base application URL |
| `LOG_LEVEL` | No | Logging verbosity |

## Setup

### Prerequisites

- Node.js 20 or newer
- pnpm 10+
- PostgreSQL

### Install

```bash
pnpm install
```

### Configure Environment

Create a `.env` file in the project root and add the required values listed above.

### Run Database Migrations

```bash
pnpm run migrate:up
```

### Start Development Server

```bash
pnpm run dev
```

### Build for Production

```bash
pnpm run build
```

### Start the Compiled App

```bash
pnpm start
```

## Workflow Notes

- Stripe webhook requests must reach `/payments/webhook` with the raw request body intact.
- M-Pesa callbacks are handled without authentication because Safaricom posts directly to the callback endpoint.
- Admin routes are protected by `authenticate` and `authorize('admin')`.
- The auth layer allows `admin` as a real role, but normal self-registration should still be controlled carefully in your deployment process.

## Database Model

The schema includes:

- `users` for all account types.
- `doctor_profiles` for provider metadata.
- `availability_slots` for weekly schedule definitions.
- `appointments` for bookings, statuses, and payment tracking.
- `payments` for provider-specific payment state and metadata.

## Implementation Notes

- The app uses request validation with Zod before controller logic runs.
- Shared middleware handles auth, authorization, and error translation.
- Service modules keep the business logic separate from route handlers.
- Payment processing is split by provider for easier debugging and maintenance.

## License

This project is currently published without an explicit license in `package.json`.