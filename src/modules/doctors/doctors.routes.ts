import { Router } from 'express';
import * as doctorsController from './doctors.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import {
  createDoctorProfileSchema,
  updateDoctorProfileSchema,
  createAvailabilitySlotsSchema,
  toggleSlotSchema,
  listDoctorsQuerySchema,
} from './doctors.schema';

const router = Router();



// Browse all doctors (patients searching for a doctor)
router.get('/', validateQuery(listDoctorsQuerySchema), doctorsController.listDoctors);

// View a specific doctor's public profile
router.get('/:profileId', doctorsController.getDoctorById);

// View a specific doctor's available slots
router.get('/:profileId/availability', doctorsController.getDoctorAvailability);

// ── Doctor-only routes ────────────────────────────────────────────────────────

// Create their own profile (one-time after registration)
router.post(
  '/profile',
  authenticate,
  authorize('doctor') as any,
  validate(createDoctorProfileSchema),
  doctorsController.createProfile
);

// View their own profile
router.get(
  '/profile/me',
  authenticate,
  authorize('doctor') as any,
  doctorsController.getMyProfile
);

// Update their own profile
router.patch(
  '/profile',
  authenticate,
  authorize('doctor') as any,
  validate(updateDoctorProfileSchema),
  doctorsController.updateProfile
);

// Set up their weekly availability slots
router.post(
  '/availability',
  authenticate,
  authorize('doctor') as any,
  validate(createAvailabilitySlotsSchema),
  doctorsController.createAvailabilitySlots
);

// View all their own slots (including inactive)
router.get(
  '/availability/me',
  authenticate,
  authorize('doctor') as any,
  doctorsController.getMyAvailability
);

// Activate or deactivate a slot
router.patch(
  '/availability/:slotId',
  authenticate,
  authorize('doctor') as any,
  validate(toggleSlotSchema),
  doctorsController.toggleSlot
);

// Permanently delete a slot (only if no upcoming appointments)
router.delete(
  '/availability/:slotId',
  authenticate,
  authorize('doctor') as any,
  doctorsController.deleteSlot
);

export default router;