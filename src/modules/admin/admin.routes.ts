import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import * as adminController from './admin.controller';
import {
  adminListUsersQuerySchema,
  adminListAppointmentsQuerySchema,
  adminListPaymentsQuerySchema,
  adminUpdateUserStatusSchema,
  adminUpdateUserRoleSchema,
  adminUpdateAppointmentStatusSchema,
  adminUpdatePaymentStatusSchema,
} from './admin.schemas';

const router: Router = Router();

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', validateQuery(adminListUsersQuerySchema), adminController.listUsers);
router.patch('/users/:userId/status', validate(adminUpdateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:userId/role', validate(adminUpdateUserRoleSchema), adminController.updateUserRole);
router.get('/appointments', validateQuery(adminListAppointmentsQuerySchema), adminController.listAppointments);
router.patch('/appointments/:appointmentId/status', validate(adminUpdateAppointmentStatusSchema), adminController.updateAppointmentStatus);
router.get('/payments', validateQuery(adminListPaymentsQuerySchema), adminController.listPayments);
router.patch('/payments/:paymentId/status', validate(adminUpdatePaymentStatusSchema), adminController.updatePaymentStatus);

export default router;
