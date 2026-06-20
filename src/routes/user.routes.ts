import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requireRole, requireReceptionistOrAdmin, requireReceptionistAdminOrBiller, requireStaff } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// User profile routes (own profile)
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.post('/avatar', UserController.uploadAvatar);
router.delete('/avatar', UserController.deleteAvatar);

// Get medical staff (doctors, specialists, nurses) - accessible by all staff (admin, receptionist, doctors, specialists, nurses)
// Receptionists need access to assign doctors/nurses/specialists to patients
// Medical staff may also need to view other staff for referrals/assignments
router.get('/medical-staff', requireStaff, UserController.getMedicalStaff);

// Get users - receptionists/admins can query any role; billers may only list role=biller (enforced in controller)
router.get('/', requireReceptionistAdminOrBiller, UserController.getUsers);
router.get('/search', requireRole(['ADMIN']), UserController.searchUsers);
router.get('/:id', UserController.getUserById);
router.post('/', requireRole(['ADMIN']), UserController.createUser);
router.put('/:id', requireRole(['ADMIN', 'BILLER']), UserController.updateUser);
router.patch('/:id/status', requireRole(['ADMIN']), UserController.updateUserStatus);
router.delete('/:id', requireRole(['ADMIN']), UserController.deleteUser);
router.get('/:id/activity', requireRole(['ADMIN']), UserController.getUserActivity);

export default router;

