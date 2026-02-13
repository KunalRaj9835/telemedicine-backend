import { Response } from 'express';
import { AuthRequest } from '../types';
import supabase from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { createMedicineSchema, updateMedicineSchema, paginationSchema } from '../validation/schemas';

// Create medicine (Admin only)
export const createMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  const validatedData = createMedicineSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Check if medicine with same name already exists
  const { data: existingMedicine } = await supabase
    .from('amedicines')
    .select('id')
    .eq('name', validatedData.name)
    .single();

  if (existingMedicine) {
    throw new AppError('Medicine with this name already exists', 409);
  }

  const { data: medicine, error } = await supabase
  .from('amedicines')
  .insert({
    name: validatedData.name,
    generic_name: validatedData.genericName,
    manufacturer: validatedData.manufacturer,
    description: validatedData.description,
    dosage_form: validatedData.dosageForm,
    strength: validatedData.strength,
    in_stock: validatedData.inStock,
    price: validatedData.price,
    created_by: req.user.id
  })
  .select()
  .single();


  if (error || !medicine) {
    throw new AppError('Failed to create medicine', 500);
  }

  res.status(201).json({
    success: true,
    message: 'Medicine added successfully',
    data: medicine
  });
};

// Get all medicines with pagination and search
export const getMedicines = async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '20', search, inStock } = req.query;
  const pagination = paginationSchema.parse({ page, limit });
  const offset = (pagination.page - 1) * pagination.limit;

  let query = supabase
    .from('amedicines')
    .select('*', { count: 'exact' });

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,generic_name.ilike.%${search}%`);
  }

  // Filter by stock status
  if (inStock !== undefined) {
    query = query.eq('in_stock', inStock === 'true');
  }

  const { data: medicines, error, count } = await query
    .order('name', { ascending: true })
    .range(offset, offset + pagination.limit - 1);

  if (error) {
    throw new AppError('Failed to fetch medicines', 500);
  }

  res.json({
    success: true,
    data: medicines || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pagination.limit)
    }
  });
};

// Get medicine by ID
export const getMedicineById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { medicineId } = req.params;

  const { data: medicine, error } = await supabase
    .from('amedicines')
    .select('*')
    .eq('id', medicineId)
    .single();

  if (error || !medicine) {
    throw new AppError('Medicine not found', 404);
  }

  res.json({
    success: true,
    data: medicine
  });
};

// Update medicine (Admin only)
export const updateMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  const { medicineId } = req.params;
  const validatedData = updateMedicineSchema.parse(req.body);

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Check if medicine exists
  const { data: existingMedicine, error: checkError } = await supabase
    .from('amedicines')
    .select('id')
    .eq('id', medicineId)
    .single();

  if (checkError || !existingMedicine) {
    throw new AppError('Medicine not found', 404);
  }

  const updateData: any = {};
  if (validatedData.name) updateData.name = validatedData.name;
  if (validatedData.genericName !== undefined) updateData.generic_name = validatedData.genericName;
  if (validatedData.manufacturer !== undefined) updateData.manufacturer = validatedData.manufacturer;
  if (validatedData.description !== undefined) updateData.description = validatedData.description;
  if (validatedData.dosageForm !== undefined) updateData.dosage_form = validatedData.dosageForm;
  if (validatedData.strength !== undefined) updateData.strength = validatedData.strength;
  if (validatedData.inStock !== undefined) updateData.in_stock = validatedData.inStock;
  if (validatedData.price !== undefined) updateData.price = validatedData.price;

  const { data: medicine, error } = await supabase
    .from('amedicines')
    .update(updateData)
    .eq('id', medicineId)
    .select()
    .single();

  if (error || !medicine) {
    throw new AppError('Failed to update medicine', 500);
  }

  res.json({
    success: true,
    message: 'Medicine updated successfully',
    data: medicine
  });
};

// Update medicine stock status (Admin only)
export const updateMedicineStock = async (req: AuthRequest, res: Response): Promise<void> => {
  const { medicineId } = req.params;
  const { inStock } = req.body;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  if (typeof inStock !== 'boolean') {
    throw new AppError('Invalid stock status', 400);
  }

  const { data: medicine, error } = await supabase
    .from('amedicines')
    .update({ in_stock: inStock })
    .eq('id', medicineId)
    .select()
    .single();

  if (error || !medicine) {
    throw new AppError('Medicine not found or failed to update', 404);
  }

  res.json({
    success: true,
    message: `Medicine marked as ${inStock ? 'in stock' : 'out of stock'}`,
    data: medicine
  });
};

// Delete medicine (Admin only)
export const deleteMedicine = async (req: AuthRequest, res: Response): Promise<void> => {
  const { medicineId } = req.params;

  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  // Check if medicine is used in any prescriptions
  const { data: prescriptionItems } = await supabase
    .from('aprescription_items')
    .select('id')
    .eq('medicine_id', medicineId)
    .limit(1);

  if (prescriptionItems && prescriptionItems.length > 0) {
    throw new AppError('Cannot delete medicine that is used in prescriptions', 400);
  }

  const { error } = await supabase
    .from('amedicines')
    .delete()
    .eq('id', medicineId);

  if (error) {
    throw new AppError('Failed to delete medicine', 500);
  }

  res.json({
    success: true,
    message: 'Medicine deleted successfully'
  });
};