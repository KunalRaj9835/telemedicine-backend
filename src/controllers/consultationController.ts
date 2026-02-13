import { Response } from 'express';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { bookConsultationSchema, updateConsultationSchema, paginationSchema } from '../validation/schemas';

// Book consultation (User only)
export const bookConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = bookConsultationSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Check if slot exists and is available
  const { data: slot, error: slotError } = await supabase
    .from('aavailability_slots')
    .select('*, adoctors(id, user_id, consultation_fee)')
    .eq('id', validatedData.slotId)
    .single();

  if (slotError || !slot) {
    throw new AppError('Slot not found', 404);
  }

  if (slot.status !== 'available') {
    throw new AppError('This slot is not available for booking', 400);
  }

  if (slot.doctor_id !== validatedData.doctorId) {
    throw new AppError('Slot does not belong to the specified doctor', 400);
  }

  // Check if slot date is in the future
  const slotDateTime = new Date(`${slot.slot_date}T${slot.start_time}`);
  if (slotDateTime < new Date()) {
    throw new AppError('Cannot book a slot in the past', 400);
  }

  // Start transaction: Create consultation and update slot status
  const { data: consultation, error: consultationError } = await supabase
    .from('aconsultations')
    .insert({
      patient_id: req.user.id,
      doctor_id: validatedData.doctorId,
      slot_id: validatedData.slotId,
      consultation_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: 'scheduled',
      chief_complaint: validatedData.chiefComplaint
    })
    .select()
    .single();

  if (consultationError || !consultation) {
    throw new AppError('Failed to book consultation', 500);
  }

  // Update slot status to booked
  const { error: updateSlotError } = await supabase
    .from('aavailability_slots')
    .update({ status: 'booked' })
    .eq('id', validatedData.slotId);

  if (updateSlotError) {
    // Rollback consultation
    await supabase.from('aconsultations').delete().eq('id', consultation.id);
    throw new AppError('Failed to book slot', 500);
  }

  // Create payment record
  const doctorInfo = slot.adoctors as any;
  const { error: paymentError } = await supabase
    .from('apayments')
    .insert({
      consultation_id: consultation.id,
      patient_id: req.user.id,
      amount: doctorInfo.consultation_fee,
      status: 'pending'
    });

  if (paymentError) {
    console.error('Failed to create payment record:', paymentError);
  }

  res.status(201).json({
    success: true,
    message: 'Consultation booked successfully',
    data: consultation
  });
};

// Get consultations for current user
export const getMyConsultations = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { page = '1', limit = '10', status } = req.query;
  const pagination = paginationSchema.parse({ page, limit });
  const offset = (pagination.page - 1) * pagination.limit;

  let query = supabase
    .from('aconsultations')
    .select(`
      *,
      adoctors (
        id,
        specialization,
        consultation_fee,
        ausers (
          aprofiles (
            first_name,
            last_name
          )
        )
      ),
      patient:ausers!aconsultations_patient_id_fkey (
        aprofiles (
          first_name,
          last_name
        )
      )
    `, { count: 'exact' });

  // Filter based on role
  if (req.user.role === 'user') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.user.role === 'doctor') {
    // Get doctor ID first
    const { data: doctor } = await supabase
      .from('adoctors')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    query = query.eq('doctor_id', doctor.id);
  }

  if (status) {
    query = query.eq('status', status as string);
  }

  const { data: consultations, error, count } = await query
    .order('consultation_date', { ascending: false })
    .order('start_time', { ascending: false })
    .range(offset, offset + pagination.limit - 1);

  if (error) {
    throw new AppError('Failed to fetch consultations', 500);
  }

  res.json({
    success: true,
    data: consultations || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pagination.limit)
    }
  });
};

// Get consultation by ID
export const getConsultationById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { consultationId } = req.params;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: consultation, error } = await supabase
    .from('aconsultations')
    .select(`
      *,
      adoctors (
        id,
        specialization,
        qualification,
        consultation_fee,
        ausers (
          aprofiles (
            first_name,
            last_name
          )
        )
      ),
      patient:ausers!aconsultations_patient_id_fkey (
        id,
        email,
        aprofiles (
          first_name,
          last_name,
          date_of_birth,
          gender,
          address,
          city,
          state
        )
      ),
      aprescriptions (
        id,
        notes,
        created_at,
        aprescription_items (
          id,
          dosage,
          frequency,
          duration_days,
          instructions,
          amedicines (
            name,
            generic_name,
            dosage_form,
            strength
          )
        )
      )
    `)
    .eq('id', consultationId)
    .single();

  if (error || !consultation) {
    throw new AppError('Consultation not found', 404);
  }

  // Check permissions
  if (req.user.role === 'user' && consultation.patient_id !== req.user.id) {
    throw new AppError('You can only view your own consultations', 403);
  }

  if (req.user.role === 'doctor') {
    const { data: doctor } = await supabase
      .from('adoctors')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!doctor || consultation.doctor_id !== doctor.id) {
      throw new AppError('You can only view your own consultations', 403);
    }
  }

  res.json({
    success: true,
    data: consultation
  });
};

// Update consultation (Doctor/Admin)
export const updateConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  const { consultationId } = req.params;
  const validatedData = updateConsultationSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get consultation
  const { data: consultation, error: consultationError } = await supabase
    .from('aconsultations')
    .select('*, adoctors(user_id)')
    .eq('id', consultationId)
    .single();

  if (consultationError || !consultation) {
    throw new AppError('Consultation not found', 404);
  }

  // Check permissions (doctor can only update own consultations)
  if (req.user.role === 'doctor') {
    const doctorUserId = (consultation.adoctors as any)?.user_id;
    if (doctorUserId !== req.user.id) {
      throw new AppError('You can only update your own consultations', 403);
    }
  }

  // Update consultation
  const { data: updatedConsultation, error: updateError } = await supabase
    .from('aconsultations')
    .update(validatedData)
    .eq('id', consultationId)
    .select()
    .single();

  if (updateError || !updatedConsultation) {
    throw new AppError('Failed to update consultation', 500);
  }

  // If status changed to cancelled, free up the slot
  if (validatedData.status === 'cancelled' && consultation.slot_id) {
    await supabase
      .from('aavailability_slots')
      .update({ status: 'available' })
      .eq('id', consultation.slot_id);
  }

  res.json({
    success: true,
    message: 'Consultation updated successfully',
    data: updatedConsultation
  });
};

// Cancel consultation (Patient can cancel own, doctor/admin can cancel any)
export const cancelConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  const { consultationId } = req.params;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: consultation, error } = await supabase
    .from('aconsultations')
    .select('*')
    .eq('id', consultationId)
    .single();

  if (error || !consultation) {
    throw new AppError('Consultation not found', 404);
  }

  // Check permissions
  if (req.user.role === 'user' && consultation.patient_id !== req.user.id) {
    throw new AppError('You can only cancel your own consultations', 403);
  }

  if (consultation.status === 'completed' || consultation.status === 'cancelled') {
    throw new AppError(`Cannot cancel a ${consultation.status} consultation`, 400);
  }

  // Update consultation status
  const { error: updateError } = await supabase
    .from('aconsultations')
    .update({ status: 'cancelled' })
    .eq('id', consultationId);

  if (updateError) {
    throw new AppError('Failed to cancel consultation', 500);
  }

  // Free up the slot
  if (consultation.slot_id) {
    await supabase
      .from('aavailability_slots')
      .update({ status: 'available' })
      .eq('id', consultation.slot_id);
  }

  res.json({
    success: true,
    message: 'Consultation cancelled successfully'
  });
};