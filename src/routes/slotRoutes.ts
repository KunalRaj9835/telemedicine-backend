import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, authorize } from '../middleware/auth';
import * as slotController from '../controllers/slotController';

const router = Router();

/**
 * @route   POST /api/slots
 * @desc    Create availability slot
 * @access  Private (Doctor/Admin)
 */
router.post(
  '/',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(slotController.createSlot)
);

/**
 * @route   GET /api/slots/my-slots
 * @desc    Get my slots (for logged-in doctor)
 * @access  Private (Doctor)
 */
router.get(
  '/my-slots',
  authenticate,
  authorize('doctor'),
  asyncHandler(slotController.getMySlots)
);

/**
 * @route   GET /api/slots/doctor/:doctorId/available
 * @desc    Get available slots for a specific doctor
 * @access  Private (for booking)
 */
router.get(
  '/doctor/:doctorId/available',
  authenticate,
  asyncHandler(slotController.getAvailableSlots)
);

/**
 * @route   GET /api/slots/doctor/:doctorId
 * @desc    Get all slots for a specific doctor
 * @access  Private
 */
router.get(
  '/doctor/:doctorId',
  authenticate,
  asyncHandler(slotController.getDoctorSlots)
);

/**
 * @route   PUT /api/slots/:slotId
 * @desc    Update availability slot
 * @access  Private (Doctor - own only, Admin - any)
 */
router.put(
  '/:slotId',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(slotController.updateSlot)
);

/**
 * @route   DELETE /api/slots/:slotId
 * @desc    Delete availability slot
 * @access  Private (Doctor - own only, Admin - any)
 */
router.delete(
  '/:slotId',
  authenticate,
  authorize('doctor', 'admin'),
  asyncHandler(slotController.deleteSlot)
);

export default router;