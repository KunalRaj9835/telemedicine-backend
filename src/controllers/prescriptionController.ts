import { Response } from 'express';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { createPrescriptionSchema } from '../validation/schemas';

// Create prescription (Doctor only)
export const createPrescription = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = createPrescriptionSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Get doctor ID
  const { data: doctor, error: doctorError } = await supabase
    .from('adoctors')
    .select('id')
    .eq('user_id', req.user.id)
    .single();

  if (doctorError || !doctor) {
    throw new AppError('Doctor profile not found', 404);
  }

  // Get consultation and verify ownership
  const { data: consultation, error: consultationError } = await supabase
    .from('aconsultations')
    .select('*')
    .eq('id', validatedData.consultationId)
    .single();

  if (consultationError || !consultation) {
    throw new AppError('Consultation not found', 404);
  }

  if (consultation.doctor_id !== doctor.id) {
    throw new AppError('You can only prescribe for your own consultations', 403);
  }

  if (consultation.status !== 'completed' && consultation.status !== 'ongoing') {
    throw new AppError('Can only prescribe for ongoing or completed consultations', 400);
  }

  // Check if prescription already exists
  const { data: existingPrescription } = await supabase
    .from('aprescriptions')
    .select('id')
    .eq('consultation_id', validatedData.consultationId)
    .single();

  if (existingPrescription) {
    throw new AppError('Prescription already exists for this consultation', 409);
  }

  // Verify all medicines exist
  const medicineIds = validatedData.items.map(item => item.medicineId);
  const { data: medicines, error: medicineError } = await supabase
    .from('amedicines')
    .select('id, name, in_stock')
    .in('id', medicineIds);

  if (medicineError || !medicines || medicines.length !== medicineIds.length) {
    throw new AppError('One or more medicines not found', 404);
  }

  // Check if all medicines are in stock
  const outOfStockMedicines = medicines.filter(m => !m.in_stock);
  if (outOfStockMedicines.length > 0) {
    throw new AppError(
      `Following medicines are out of stock: ${outOfStockMedicines.map(m => m.name).join(', ')}`,
      400
    );
  }

  // Create prescription
  const { data: prescription, error: prescriptionError } = await supabase
    .from('aprescriptions')
    .insert({
      consultation_id: validatedData.consultationId,
      doctor_id: doctor.id,
      patient_id: consultation.patient_id,
      notes: validatedData.notes
    })
    .select()
    .single();

  if (prescriptionError || !prescription) {
    throw new AppError('Failed to create prescription', 500);
  }

  // Create prescription items
  const prescriptionItems = validatedData.items.map(item => ({
    prescription_id: prescription.id,
    medicine_id: item.medicineId,
    dosage: item.dosage,
    frequency: item.frequency,
    duration_days: item.durationDays,
    instructions: item.instructions
  }));

  const { error: itemsError } = await supabase
    .from('aprescription_items')
    .insert(prescriptionItems);

  if (itemsError) {
    // Rollback prescription creation
    await supabase.from('aprescriptions').delete().eq('id', prescription.id);
    throw new AppError('Failed to create prescription items', 500);
  }

  // Fetch complete prescription with items
  const { data: completePrescription } = await supabase
    .from('aprescriptions')
    .select(`
      *,
      aprescription_items (
        id,
        dosage,
        frequency,
        duration_days,
        instructions,
        amedicines (
          id,
          name,
          generic_name,
          dosage_form,
          strength,
          manufacturer
        )
      )
    `)
    .eq('id', prescription.id)
    .single();

  res.status(201).json({
    success: true,
    message: 'Prescription created successfully',
    data: completePrescription
  });
};

// Get prescription by consultation ID
export const getPrescriptionByConsultation = async (req: AuthRequest, res: Response): Promise<void> => {
  const { consultationId } = req.params;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: prescription, error } = await supabase
    .from('aprescriptions')
    .select(`
      *,
      aconsultations (
        patient_id,
        doctor_id,
        consultation_date
      ),
      aprescription_items (
        id,
        dosage,
        frequency,
        duration_days,
        instructions,
        amedicines (
          id,
          name,
          generic_name,
          dosage_form,
          strength,
          manufacturer,
          price
        )
      ),
      doctor:adoctors!aprescriptions_doctor_id_fkey (
        specialization,
        qualification,
        ausers (
          aprofiles (
            first_name,
            last_name
          )
        )
      ),
      patient:ausers!aprescriptions_patient_id_fkey (
        email,
        aprofiles (
          first_name,
          last_name,
          date_of_birth,
          gender
        )
      )
    `)
    .eq('consultation_id', consultationId)
    .single();

  if (error || !prescription) {
    throw new AppError('Prescription not found', 404);
  }

  // Check permissions
  const consultation = prescription.aconsultations as any;
  
  if (req.user.role === 'user' && consultation.patient_id !== req.user.id) {
    throw new AppError('You can only view your own prescriptions', 403);
  }

  if (req.user.role === 'doctor') {
    const { data: doctor } = await supabase
      .from('adoctors')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (!doctor || consultation.doctor_id !== doctor.id) {
      throw new AppError('You can only view prescriptions for your consultations', 403);
    }
  }

  res.json({
    success: true,
    data: prescription
  });
};

// Get all prescriptions for a patient
export const getMyPrescriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { data: prescriptions, error } = await supabase
    .from('aprescriptions')
    .select(`
      *,
      aprescription_items (
        id,
        dosage,
        frequency,
        duration_days,
        instructions,
        amedicines (
          id,
          name,
          generic_name,
          dosage_form,
          strength
        )
      ),
      aconsultations (
        consultation_date,
        chief_complaint
      ),
      doctor:adoctors!aprescriptions_doctor_id_fkey (
        specialization,
        ausers (
          aprofiles (
            first_name,
            last_name
          )
        )
      )
    `)
    .eq('patient_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch prescriptions', 500);
  }

  res.json({
    success: true,
    data: prescriptions || []
  });
};