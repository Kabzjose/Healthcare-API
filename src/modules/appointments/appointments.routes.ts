import { Router } from 'express';
import * as appointmentsController from './appointments.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import {
  bookAppointmentSchema,
  updateAppointmentStatusSchema,
  cancelAppointmentSchema,
  getDoctorAppointmentsQuerySchema,
  listAppointmentsQuerySchema,
} from './appointments.schema';

const router: Router = Router();

// ── These MUST come before /:appointmentId ────────────────────────────────────

router.post(
  '/',
  authenticate,
  authorize('patient'),
  validate(bookAppointmentSchema),
  appointmentsController.createAppointment
);

router.get(
  '/my',
  authenticate,
  authorize('patient'),
  validateQuery(listAppointmentsQuerySchema),
  appointmentsController.getMyAppointments
);

router.get(
  '/doctor/my',
  authenticate,
  authorize('doctor'),
  validateQuery(getDoctorAppointmentsQuerySchema),
  appointmentsController.getMyAppointments
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize('patient'),
  validate(cancelAppointmentSchema),
  appointmentsController.cancelAppointment
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('doctor'),
  validate(updateAppointmentStatusSchema),
  appointmentsController.updateAppointmentStatus
);

// ── /:appointmentId MUST be last ──────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  authorize('patient', 'doctor', 'admin'),
  appointmentsController.getAppointmentById
);

export default router;