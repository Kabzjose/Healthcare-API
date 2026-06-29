import { Request } from 'express';


export type UserRole = 'patient' | 'doctor' | 'admin';


export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';


export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// ── Database row shapes (what pg returns) 
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DoctorProfileRow {
  id: string;
  user_id: string;
  specialization: string;
  license_number: string;
  bio: string | null;
  consultation_fee: number;
  years_of_experience: number;
  created_at: Date;
  updated_at: Date;
}

export interface AvailabilitySlotRow {
  id: string;
  doctor_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // e.g. "09:00"
  end_time: string;   // e.g. "09:30"
  is_active: boolean;
  created_at: Date;
}

export interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  availability_slot_id: string;
  appointment_date: Date;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  consultation_fee: number;
  created_at: Date;
  updated_at: Date;
}

// ── JWT payload 
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// ── Extends Express Request to carry the authenticated user 
// After the authenticate middleware runs, req.user is always populated
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// ── Safe public user (never expose password_hash to clients) 
export type PublicUser = Omit<UserRow, 'password_hash'>;

// ── Pagination 
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}