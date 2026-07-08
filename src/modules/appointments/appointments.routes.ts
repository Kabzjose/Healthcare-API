import { Router } from 'express';
import * as appointmentController from './appointments.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  listAppointmentsSchema,
} from './appointments.schema';

const router: Router = Router();

// ── Patient Routes ───────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('patient'),
  validate(createAppointmentSchema),
  appointmentController.createAppointment
);

router.post(
  '/:id/cancel',
  authenticate,
  authorize('patient'),
  appointmentController.cancelAppointment
);

// ── Doctor Routes ────────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authenticate,
  authorize('doctor'),
  validate(updateAppointmentStatusSchema),
  appointmentController.updateAppointmentStatus
);

// ── Shared Routes (Patient & Doctor) ─────────────────────────────────────────
router.get(
  '/',
  authenticate,
  authorize('patient', 'doctor'),
  validate(listAppointmentsSchema),
  appointmentController.getMyAppointments
);

router.get(
  '/:id',
  authenticate,
  authorize('patient', 'doctor'),
  appointmentController.getAppointmentById
);

export default router;