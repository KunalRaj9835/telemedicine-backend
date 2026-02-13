import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  role: z.enum(['user', 'doctor']).default('user'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Profile Schemas
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  profileImageUrl: z.string().url().optional()
});

// Doctor Schemas
export const createDoctorProfileSchema = z.object({
  specialization: z.string().min(1, 'Specialization is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  experienceYears: z.number().min(0).optional(),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  consultationFee: z.number().min(0, 'Consultation fee must be positive'),
  bio: z.string().optional()
});

export const updateDoctorProfileSchema = z.object({
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experienceYears: z.number().min(0).optional(),
  consultationFee: z.number().min(0).optional(),
  bio: z.string().optional()
});

// Availability Slot Schemas
export const createSlotSchema = z.object({
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Invalid time format (HH:MM:SS)'),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Invalid time format (HH:MM:SS)')
}).refine(data => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime']
});

export const updateSlotSchema = z.object({
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  status: z.enum(['available', 'booked', 'blocked']).optional()
});

// Consultation Schemas
export const bookConsultationSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor ID'),
  slotId: z.string().uuid('Invalid slot ID'),
  chiefComplaint: z.string().min(1, 'Chief complaint is required')
});

export const updateConsultationSchema = z.object({
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled', 'no_show']).optional(),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
  meetingLink: z.string().url().optional()
});

// Prescription Schemas
export const createPrescriptionSchema = z.object({
  consultationId: z.string().uuid('Invalid consultation ID'),
  notes: z.string().optional(),
  items: z.array(z.object({
    medicineId: z.string().uuid('Invalid medicine ID'),
    dosage: z.string().min(1, 'Dosage is required'),
    frequency: z.string().min(1, 'Frequency is required'),
    durationDays: z.number().min(1, 'Duration must be at least 1 day'),
    instructions: z.string().optional()
  })).min(1, 'At least one medicine item is required')
});

// Medicine Schemas
export const createMedicineSchema = z.object({
  name: z.string().min(1, 'Medicine name is required'),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  description: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  inStock: z.boolean().default(true),
  price: z.number().min(0).optional()
});

export const updateMedicineSchema = z.object({
  name: z.string().optional(),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  description: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  inStock: z.boolean().optional(),
  price: z.number().min(0).optional()
});

// Query Params Schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default(1),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default(10)
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});