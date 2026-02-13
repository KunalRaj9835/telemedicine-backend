import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import * as medicineController from '../controllers/medicineController';

const router = Router();

/**
 * @route   POST /api/medicines
 * @desc    Add a new medicine
 * @access  Private (Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  asyncHandler(medicineController.createMedicine)
);

/**
 * @route   GET /api/medicines
 * @desc    Get all medicines with pagination and search
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(medicineController.getMedicines)
);

/**
 * @route   GET /api/medicines/:medicineId
 * @desc    Get medicine by ID
 * @access  Private
 */
router.get(
  '/:medicineId',
  authenticate,
  asyncHandler(medicineController.getMedicineById)
);

/**
 * @route   PUT /api/medicines/:medicineId
 * @desc    Update medicine
 * @access  Private (Admin)
 */
router.put(
  '/:medicineId',
  authenticate,
  authorize('admin'),
  asyncHandler(medicineController.updateMedicine)
);

/**
 * @route   PUT /api/medicines/:medicineId/stock
 * @desc    Update medicine stock status
 * @access  Private (Admin)
 */
router.put(
  '/:medicineId/stock',
  authenticate,
  authorize('admin'),
  asyncHandler(medicineController.updateMedicineStock)
);

/**
 * @route   DELETE /api/medicines/:medicineId
 * @desc    Delete medicine
 * @access  Private (Admin)
 */
router.delete(
  '/:medicineId',
  authenticate,
  authorize('admin'),
  asyncHandler(medicineController.deleteMedicine)
);

export default router;