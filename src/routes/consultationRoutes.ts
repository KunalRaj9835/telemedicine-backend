import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import * as consultationController from '../controllers/consultationController';

const router = Router();

/**
 * @route   POST /api/consultations/book
 * @desc    Book a consultation
 * @access  Private (User)
 */
router.post(
  '/book',
  authenticate,
  authorize('user'),
  asyncHandler(consultationController.bookConsultation)
);

/**
 * @route   GET /api/consultations/my-consultations
 * @desc    Get my consultations (patient or doctor)
 * @access  Private
 */
router.get(
  '/my-consultations',
  authenticate,
  asyncHandler(consultationController.getMyConsultations)
);

/**
 * @route   PUT /api/consultations/:consultationId/cancel
 * @desc    Cancel consultation
 * @access  Private (Patient can cancel own, Doctor/Admin can cancel any)
 */
router.put(
  '/:consultationId/cancel',
  authenticate,
  asyncHandler(consultationController.cancelConsultation)
);

/**
 * @route   GET /api/consultations/:consultationId
 * @desc    Get consultation by ID
 * @access  Private (Own consultations only)
 */
router.get(
  '/:consultationId',
  authenticate,
  asyncHandler(consultationController.getConsultationById)
);

/**
 * @route   PUT /api/consultations/:consultationId
 * @desc    Update consultation
 * @access  Private (Doctor/Admin)
 */
router.put(
  '/:consultationId',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(consultationController.updateConsultation)
);

export default router;