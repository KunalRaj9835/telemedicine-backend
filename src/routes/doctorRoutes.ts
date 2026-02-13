import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import * as doctorController from '../controllers/doctorController';

const router = Router();

/**
 * @route   POST /api/doctors
 * @desc    Create doctor profile
 * @access  Private (Admin or Doctor creating own profile)
 */
router.post(
  '/',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(doctorController.createDoctorProfile)
);

/**
 * @route   GET /api/doctors/my-stats
 * @desc    Get my doctor statistics
 * @access  Private (Doctor)
 */
router.get(
  '/my-stats',
  authenticate,
  authorize('doctor'),
  asyncHandler(doctorController.getMyDoctorStats)
);

/**
 * @route   GET /api/doctors
 * @desc    Get all doctors with filters
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(doctorController.getAllDoctors)
);

/**
 * @route   GET /api/doctors/:doctorId
 * @desc    Get doctor by ID
 * @access  Private
 */
router.get(
  '/:doctorId',
  authenticate,
  asyncHandler(doctorController.getDoctorById)
);

/**
 * @route   PUT /api/doctors/:doctorId/verify
 * @desc    Verify/Unverify doctor
 * @access  Private (Admin)
 */
router.put(
  '/:doctorId/verify',
  authenticate,
  authorize('admin'),
  asyncHandler(doctorController.verifyDoctor)
);

/**
 * @route   PUT /api/doctors/:doctorId
 * @desc    Update doctor profile
 * @access  Private (Doctor - own only, Admin - any)
 */
router.put(
  '/:doctorId',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(doctorController.updateDoctorProfile)
);

export default router;