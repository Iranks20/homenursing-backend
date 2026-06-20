import { Router } from 'express';
import { CommunicationController } from '../controllers/communication.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/messages', CommunicationController.getMessages);
router.get('/messages/:id', CommunicationController.getMessageById);
router.post('/send', CommunicationController.sendMessage);
router.put('/messages/:id', CommunicationController.updateMessage);
router.delete('/messages/:id', CommunicationController.deleteMessage);
router.get('/conversations', CommunicationController.getConversations);
router.get('/conversations/:id', CommunicationController.getConversationById);

export default router;

