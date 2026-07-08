import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import * as adminService from './admin.service';
import {
  AdminListUsersQuery,
  AdminListAppointmentsQuery,
  AdminListPaymentsQuery,
  AdminUpdateUserStatusInput,
  AdminUpdateUserRoleInput,
  AdminUpdateAppointmentStatusInput,
  AdminUpdatePaymentStatusInput,
} from './admin.schemas';

type AdminParamRequest = Request<{ userId: string; appointmentId: string; paymentId: string }>;

export const getDashboard = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const result = await adminService.getDashboardOverview();
  return ApiResponse.ok(res, 'Dashboard loaded', result);
});

export const listUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await adminService.listUsers(req.query as unknown as AdminListUsersQuery);
  return ApiResponse.ok(res, 'Users fetched', result.data, result.meta as Record<string, unknown>);
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  await adminService.updateUserStatus((req as AdminParamRequest).params.userId, req.body as AdminUpdateUserStatusInput);
  return ApiResponse.ok(res, 'User status updated');
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  await adminService.updateUserRole((req as AdminParamRequest).params.userId, req.body as AdminUpdateUserRoleInput);
  return ApiResponse.ok(res, 'User role updated');
});

export const listAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await adminService.listAppointments(req.query as unknown as AdminListAppointmentsQuery);
  return ApiResponse.ok(res, 'Appointments fetched', result.data, result.meta as Record<string, unknown>);
});

export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response) => {
  await adminService.updateAppointmentStatus((req as AdminParamRequest).params.appointmentId, req.body as AdminUpdateAppointmentStatusInput);
  return ApiResponse.ok(res, 'Appointment status updated');
});

export const listPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await adminService.listPayments(req.query as unknown as AdminListPaymentsQuery);
  return ApiResponse.ok(res, 'Payments fetched', result.data, result.meta as Record<string, unknown>);
});

export const updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  await adminService.updatePaymentStatus((req as AdminParamRequest).params.paymentId, req.body as AdminUpdatePaymentStatusInput);
  return ApiResponse.ok(res, 'Payment status updated');
});
