import { Router } from 'express';
import { AppointmentController } from '../controllers/appointment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', AppointmentController.getAppointments);
router.get('/search', AppointmentController.getAppointments);
router.get('/patient/:patientId', AppointmentController.getPatientAppointments);
router.get('/nurse/:nurseId', AppointmentController.getNurseAppointments);
router.get('/specialist/:specialistId', AppointmentController.getSpecialistAppointments);
router.get('/available-slots', AppointmentController.getAvailableSlots);
router.get('/calendar/:userId', AppointmentController.getCalendarView);
router.get('/:id', AppointmentController.getAppointmentById);

router.post('/', AppointmentController.createAppointment);
router.post('/check-conflicts', AppointmentController.checkConflicts);
router.put('/:id', AppointmentController.updateAppointment);
router.patch('/:id/cancel', AppointmentController.cancelAppointment);
router.patch('/:id/reschedule', AppointmentController.rescheduleAppointment);
router.patch('/:id/complete', AppointmentController.completeAppointment);
router.patch('/:id/start', AppointmentController.startAppointment);
router.patch('/:id/no-show', AppointmentController.markAsNoShow);
router.post('/:id/notes', AppointmentController.addNotes);

export default router;

