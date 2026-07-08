import { Response, NextFunction, RequestHandler } from 'express';
import * as appointmentService from './appointments.service';
import { AuthenticatedRequest } from '../../types';

// ── Create Appointment ───────────────────────────────────────────────────────
export const createAppointment: RequestHandler = async (
  req,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const patientId = authReq.user.userId;
    const appointment = await appointmentService.createAppointment(patientId, authReq.body);
    
    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// ── Cancel Appointment ───────────────────────────────────────────────────────
export const cancelAppointment: RequestHandler = async (
  req,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const patientId = authReq.user.userId;
    const { id } = authReq.params;
    const appointmentId = Array.isArray(id) ? id[0] : id;
    
    const appointment = await appointmentService.cancelAppointment(appointmentId, patientId);
    
    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// ── Update Status (Doctor) ───────────────────────────────────────────────────
export const updateAppointmentStatus: RequestHandler = async (
  req,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const doctorId = authReq.user.userId; // Assuming this is the doctor's profile ID or user ID mapped correctly
    const { id } = authReq.params;
    const appointmentId = Array.isArray(id) ? id[0] : id;
    
    // Note: If req.user.id is the user_id and not the profile_id, 
    // you might need to fetch the profile_id first like in the doctors module.
    const appointment = await appointmentService.updateAppointmentStatus(appointmentId, doctorId, authReq.body);
    
    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// ── List Appointments ────────────────────────────────────────────────────────
export const getMyAppointments: RequestHandler = async (
  req,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;
    const role = authReq.user.role;
    
    const result = await appointmentService.listAppointments(userId, role, authReq.query as any);
    
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ── Get Single Appointment ───────────────────────────────────────────────────
export const getAppointmentById: RequestHandler = async (
  req,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.userId;
    const role = authReq.user.role;
    const { id } = authReq.params;
    const appointmentId = Array.isArray(id) ? id[0] : id;
    
    const appointment = await appointmentService.getAppointmentById(appointmentId, userId, role);
    
    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};