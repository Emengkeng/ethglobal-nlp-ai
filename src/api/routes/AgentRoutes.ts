import express from 'express';
import { AgentController } from '@/api/controllers/AgentController';

const router = express.Router();
const agentController = new AgentController();

// Existing message handling route
router.post('/message', (req, res) => agentController.handleMessage(req, res));

// New routes for agent management
router.post('/kill-all', (req, res) => agentController.killAllAgents(req, res));
router.get('/termination-status', (req, res) => agentController.getTerminationStatus(req, res));

export default router;