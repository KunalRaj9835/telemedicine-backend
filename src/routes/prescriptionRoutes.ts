import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import * as prescriptionController from '../controllers/prescriptionController';

const router = Router();

/**
 * @route   POST /api/prescriptions
 * @desc    Create prescription
 * @access  Private (Doctor)
 */
router.post(
  '/',
  authenticate,
  authorize('doctor'),
  asyncHandler(prescriptionController.createPrescription)
);

/**
 * @route   GET /api/prescriptions/my-prescriptions
 * @desc    Get all my prescriptions (as patient)
 * @access  Private (User)
 */
router.get(
  '/my-prescriptions',
  authenticate,
  authorize('user'),
  asyncHandler(prescriptionController.getMyPrescriptions)
);

/**
 * @route   GET /api/prescriptions/consultation/:consultationId
 * @desc    Get prescription for a consultation
 * @access  Private
 */
router.get(
  '/consultation/:consultationId',
  authenticate,
  asyncHandler(prescriptionController.getPrescriptionByConsultation)
);

export default router;