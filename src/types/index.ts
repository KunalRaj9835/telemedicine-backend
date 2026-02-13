import { Request } from 'express';

// User Roles
export type UserRole = 'user' | 'doctor' | 'admin';

// Consultation Status
export type ConsultationStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'no_show';

// Payment Status
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Availability Status
export type AvailabilityStatus = 'available' | 'booked' | 'blocked';

// Database Models
export interface User {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  mfa_enabled: boolean;
  mfa_secret?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profile_image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Doctor {
  id: string;
  user_id: string;
  specialization: string;
  qualification: string;
  experience_years?: number;
  registration_number: string;
  consultation_fee: number;
  bio?: string;
  is_verified: boolean;
  rating: number;
  total_consultations: number;
  created_at: Date;
  updated_at: Date;
}

export interface AvailabilitySlot {
  id: string;
  doctor_id: string;
  slot_date: Date;
  start_time: string;
  end_time: string;
  status: AvailabilityStatus;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Medicine {
  id: string;
  name: string;
  generic_name?: string;
  manufacturer?: string;
  description?: string;
  dosage_form?: string;
  strength?: string;
  in_stock: boolean;
  price?: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id?: string;
  consultation_date: Date;
  start_time: string;
  end_time: string;
  status: ConsultationStatus;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
  meeting_link?: string;
  actual_start_time?: Date;
  actual_end_time?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  doctor_id: string;
  patient_id: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medicine_id: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
  created_at: Date;
}

export interface Payment {
  id: string;
  consultation_id: string;
  patient_id: string;
  amount: number;
  status: PaymentStatus;
  payment_method?: string;
  transaction_id?: string;
  gateway_response?: Record<string, any>;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Extended Request with User
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}