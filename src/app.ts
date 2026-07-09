import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './config/logger';
import authRoutes from './modules/auth/auth.routes';
import doctorsRoutes from './modules/doctors/doctors.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';  
import paymentsRoutes from './modules/payments/payments.routes';              
import adminRoutes from './modules/admin/admin.routes';

const app: express.Express = express();

app.use(helmet()); 

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Explicitly handle preflight requests for all routes
app.options('*', cors());

// Trust the first proxy (e.g., if behind a load balancer or reverse proxy)
app.set('trust proxy', 1); 

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,  // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS,    // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

// Stricter limiter for auth endpoints only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // only 10 login attempts per 15 min
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
});

app.use(limiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Skip JSON parsing for the Stripe webhook route — it needs the raw body
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook') {
    next(); // skip — express.raw() on the route itself handles it
  } else {
    express.json({ limit: '10kb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));
// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Health check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running', env: env.NODE_ENV });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/doctors', doctorsRoutes);
app.use('/appointments', appointmentsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/admin', adminRoutes);
// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export default app;