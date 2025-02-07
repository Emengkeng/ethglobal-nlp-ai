import { Router } from 'express';
import { ChatAPIController } from '../controllers/chatAPI.controller';

const router = Router();
const controller = new ChatAPIController();

router.post('/chat', controller.chat);
router.get('/status', controller.getStatus);

export default router;