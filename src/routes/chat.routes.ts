import { Router, Request, Response } from 'express';
import { ChatAPIController } from '../controllers/chatAPI.controller';

const router = Router();
const controller = new ChatAPIController();

router.post('/chat', async (req: Request, res: Response) => {
  await controller.chat(req, res);
});

router.get('/status', async (req: Request, res: Response) => {
  await controller.getStatus(req, res);
});

export default router;