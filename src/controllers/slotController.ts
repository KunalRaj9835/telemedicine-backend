import { Response } from 'express';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { createSlotSchema, updateSlotSchema, paginationSchema } from '../validation/schemas';

// Create availability slot (Doctor/Admin only)
export const createSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = createSlotSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get doctor ID from user
  const { data: doctor, error: doctorError } = await supabase
    .from('adoctors')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  if (doctorError || !doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  // Check for overlapping slots
  const { data: existingSlots } = await supabase
    .from('aavailability_slots')
    .select('*')
    .eq('doctor_id', doctor.id)
    .eq('slot_date', validatedData.slotDate)
    .or(`and(start_time.lte.${validatedData.endTime},end_time.gte.${validatedData.startTime})`);

  if (existingSlots && existingSlots.length > 0) {
    throw new AppError('This time slot overlaps with an existing slot', 409);
  }

  // Create slot
  const { data: slot, error } = await supabase
    .from('aavailability_slots')
    .insert({
      doctor_id: doctor.id,
      slot_date: validatedData.slotDate,
      start_time: validatedData.startTime,
      end_time: validatedData.endTime,
      status: 'available',
      created_by: req.user.id
    })
    .select()
    .single();

  if (error || !slot) {
    throw new AppError('Failed to create slot', 500);
  }

  res.status(201).json({
    success: true,
    message: 'Availability slot created successfully',
    data: slot
  });
};

// Get all slots for a doctor
export const getDoctorSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const { page = '1', limit = '10', startDate, endDate } = req.query;
  
  const pagination = paginationSchema.parse({ page, limit });
  const offset = (pagination.page - 1) * pagination.limit;

  let query = supabase
    .from('aavailability_slots')
    .select('*', { count: 'exact' })
    .eq('doctor_id', doctorId)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  // Apply date filters if provided
  if (startDate) {
    query = query.gte('slot_date', startDate as string);
  }
  if (endDate) {
    query = query.lte('slot_date', endDate as string);
  }

  const { data: slots, error, count } = await query
    .range(offset, offset + pagination.limit - 1);

  if (error) {
    throw new AppError('Failed to fetch slots', 500);
  }

  res.json({
    success: true,
    data: slots || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pagination.limit)
    }
  });
};

// Get available slots for a doctor (for patients to book)
export const getAvailableSlots = async (req: AuthRequest, res: Response): Promise<void> => {
  const { doctorId } = req.params;
  const { startDate, endDate } = req.query;

  let query = supabase
    .from('aavailability_slots')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'available')
    .gte('slot_date', startDate as string || new Date().toISOString().split('T')[0])
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (endDate) {
    query = query.lte('slot_date', endDate as string);
  }

  const { data: slots, error } = await query;

  if (error) {
    throw new AppError('Failed to fetch available slots', 500);
  }

  res.json({
    success: true,
    data: slots || []
  });
};

// Update slot (Doctor can update own slots, Admin can update any)
export const updateSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  const { slotId } = req.params;
  const validatedData = updateSlotSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get the slot
  const { data: slot, error: slotError } = await supabase
    .from('aavailability_slots')
    .select('*, adoctors(user_id)')
    .eq('id', slotId)
    .single();

  if (slotError || !slot) {
    throw new AppError('Slot not found', 404);
  }

  // Check permissions (doctor can only update own slots)
  if (req.user.role === 'doctor') {
    const doctorUserId = (slot.adoctors as any)?.user_id;
    if (doctorUserId !== req.user.id) {
      throw new AppError('You can only update your own slots', 403);
    }
  }

  // Update slot
  const { data: updatedSlot, error: updateError } = await supabase
    .from('aavailability_slots')
    .update(validatedData)
    .eq('id', slotId)
    .select()
    .single();

  if (updateError || !updatedSlot) {
    throw new AppError('Failed to update slot', 500);
  }

  res.json({
    success: true,
    message: 'Slot updated successfully',
    data: updatedSlot
  });
};

// Delete slot
export const deleteSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  const { slotId } = req.params;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get the slot
  const { data: slot, error: slotError } = await supabase
    .from('aavailability_slots')
    .select('*, adoctors(user_id)')
    .eq('id', slotId)
    .single();

  if (slotError || !slot) {
    throw new AppError('Slot not found', 404);
  }

  // Check if slot is already booked
  if (slot.status === 'booked') {
    throw new AppError('Cannot delete a booked slot', 400);
  }

  // Check permissions
  if (req.user.role === 'doctor') {
    const doctorUserId = (slot.adoctors as any)?.user_id;
    if (doctorUserId !== req.user.id) {
      throw new AppError('You can only delete your own slots', 403);
    }
  }

  // Delete slot
  const { error: deleteError } = await supabase
    .from('aavailability_slots')
    .delete()
    .eq('id', slotId);

  if (deleteError) {
    throw new AppError('Failed to delete slot', 500);
  }

  res.json({
    success: true,
    message: 'Slot deleted successfully'
  });
};

// Get my slots (for logged-in doctor)
export const getMySlots = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get doctor ID
  const { data: doctor } = await supabase
    .from('adoctors')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  if (!doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  const { page = '1', limit = '20' } = req.query;
  const pagination = paginationSchema.parse({ page, limit });
  const offset = (pagination.page - 1) * pagination.limit;

  const { data: slots, error, count } = await supabase
    .from('aavailability_slots')
    .select('*', { count: 'exact' })
    .eq('doctor_id', doctor.id)
    .gte('slot_date', new Date().toISOString().split('T')[0])
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true })
    .range(offset, offset + pagination.limit - 1);

  if (error) {
    throw new AppError('Failed to fetch your slots', 500);
  }

  res.json({
    success: true,
    data: slots || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pagination.limit)
    }
  });
};