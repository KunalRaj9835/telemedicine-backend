import { Response } from 'express';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { createDoctorProfileSchema, updateDoctorProfileSchema, paginationSchema } from '../validation/schemas';

// Get all doctors with pagination and filters
export const getAllDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '10', specialization, verified } = req.query;
  const pagination = paginationSchema.parse({ page, limit });
  const offset = (pagination.page - 1) * pagination.limit;

  let query = supabase
    .from('adoctors')
    .select(`
      *,
      ausers (
        id,
        email,
        aprofiles (
          first_name,
          last_name,
          profile_image_url
        )
      )
    `, { count: 'exact' });

  if (specialization) {
    query = query.ilike('specialization', `%${specialization}%`);
  }

  if (verified !== undefined) {
    query = query.eq('is_verified', verified === 'true');
  }

  const { data: doctors, error, count } = await query
    .order('rating', { ascending: false })
    .order('total_consultations', { ascending: false })
    .range(offset, offset + pagination.limit - 1);

  if (error) {
    throw new AppError('Failed to fetch doctors', 500);
  }

  res.json({
    success: true,
    data: doctors || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pagination.limit)
    }
  });
};

// Get doctor by ID
export const getDoctorById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;

  const { data: doctor, error } = await supabase
    .from('adoctors')
    .select(`
      *,
      ausers (
        id,
        email,
        phone,
        aprofiles (
          first_name,
          last_name,
          gender,
          profile_image_url,
          city,
          state
        )
      )
    `)
    .eq('id', doctorId)
    .single();

  if (error || !doctor) {
    throw new AppError('Doctor not found', 404);
  }

  res.json({
    success: true,
    data: doctor
  });
};

// Create doctor profile (Admin only or during doctor registration)
export const createDoctorProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = createDoctorProfileSchema.parse(req.body);
  const { userId } = req.body;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Only admin can create doctor profile for other users
  if (req.user.role !== 'admin' && userId && userId !== req.user.id) {
    throw new AppError('Only admins can create doctor profiles for other users', 403);
  }

  const targetUserId = userId || req.user.id;

  // Check if user exists and has doctor role
  const { data: user, error: userError } = await supabase
    .from('ausers')
    .select('id, role')
    .eq('id', targetUserId)
    .single();

  if (userError || !user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== 'doctor') {
    throw new AppError('User must have doctor role', 400);
  }

  // Check if doctor profile already exists
  const { data: existingDoctor } = await supabase
    .from('adoctors')
    .select('id')
    .eq('user_id', targetUserId)
    .single();

  if (existingDoctor) {
    throw new AppError('Doctor profile already exists for this user', 409);
  }

  // Check if registration number is unique
  const { data: existingReg } = await supabase
    .from('adoctors')
    .select('id')
    .eq('registration_number', validatedData.registrationNumber)
    .single();

  if (existingReg) {
    throw new AppError('Registration number already in use', 409);
  }

  const { data: doctor, error } = await supabase
    .from('adoctors')
    .insert({
      user_id: targetUserId,
      specialization: validatedData.specialization,
      qualification: validatedData.qualification,
      experience_years: validatedData.experienceYears,
      registration_number: validatedData.registrationNumber,
      consultation_fee: validatedData.consultationFee,
      bio: validatedData.bio,
      is_verified: req.user.role === 'admin' // Auto-verify if created by admin
    })
    .select()
    .single();

  if (error || !doctor) {
    throw new AppError('Failed to create doctor profile', 500);
  }

  res.status(201).json({
    success: true,
    message: 'Doctor profile created successfully',
    data: doctor
  });
};

// Update doctor profile
export const updateDoctorProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const validatedData = updateDoctorProfileSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get doctor to check ownership
  const { data: doctor, error: doctorError } = await supabase
    .from('adoctors')
    .select('user_id')
    .eq('id', doctorId)
    .single();

  if (doctorError || !doctor) {
    throw new AppError('Doctor not found', 404);
  }

  // Check permissions (doctor can only update own profile)
  if (req.user.role === 'doctor' && doctor.user_id !== req.user.id) {
    throw new AppError('You can only update your own profile', 403);
  }

  const updateData: any = {};
  if (validatedData.specialization) updateData.specialization = validatedData.specialization;
  if (validatedData.qualification) updateData.qualification = validatedData.qualification;
  if (validatedData.experienceYears !== undefined) updateData.experience_years = validatedData.experienceYears;
  if (validatedData.consultationFee !== undefined) updateData.consultation_fee = validatedData.consultationFee;
  if (validatedData.bio !== undefined) updateData.bio = validatedData.bio;

  const { data: updatedDoctor, error } = await supabase
    .from('adoctors')
    .update(updateData)
    .eq('id', doctorId)
    .select()
    .single();

  if (error || !updatedDoctor) {
    throw new AppError('Failed to update doctor profile', 500);
  }

  res.json({
    success: true,
    message: 'Doctor profile updated successfully',
    data: updatedDoctor
  });
};

// Verify doctor (Admin only)
export const verifyDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const { isVerified } = req.body;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  if (typeof isVerified !== 'boolean') {
    throw new AppError('Invalid verification status', 400);
  }

  const { data: doctor, error } = await supabase
    .from('adoctors')
    .update({ is_verified: isVerified })
    .eq('id', doctorId)
    .select()
    .single();

  if (error || !doctor) {
    throw new AppError('Doctor not found or failed to verify', 404);
  }

  res.json({
    success: true,
    message: `Doctor ${isVerified ? 'verified' : 'unverified'} successfully`,
    data: doctor
  });
};

// Get doctor statistics (for the logged-in doctor)
export const getMyDoctorStats = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: doctor } = await supabase
    .from('adoctors')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  if (!doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  // Get consultation statistics
  const { data: consultations } = await supabase
    .from('aconsultations')
    .select('status')
    .eq('doctor_id', doctor.id);

  const stats = {
    totalConsultations: consultations?.length || 0,
    completed: consultations?.filter(c => c.status === 'completed').length || 0,
    scheduled: consultations?.filter(c => c.status === 'scheduled').length || 0,
    ongoing: consultations?.filter(c => c.status === 'ongoing').length || 0,
    cancelled: consultations?.filter(c => c.status === 'cancelled').length || 0
  };

  // Get today's consultations
  const today = new Date().toISOString().split('T')[0];
  const { data: todayConsultations } = await supabase
    .from('aconsultations')
    .select('*')
    .eq('doctor_id', doctor.id)
    .eq('consultation_date', today);

  res.json({
    success: true,
    data: {
      stats,
      todayConsultations: todayConsultations || []
    }
  });
};