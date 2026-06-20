import { Router } from 'express';
import { FileUploadController } from '../controllers/fileUpload.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/avatar', FileUploadController.uploadAvatar, FileUploadController.handleAvatarUpload);
router.post('/document', FileUploadController.uploadDocument, FileUploadController.handleDocumentUpload);
router.post('/image', FileUploadController.uploadImage, FileUploadController.handleImageUpload);
router.delete('/:fileId', FileUploadController.deleteFile);

export default router;

