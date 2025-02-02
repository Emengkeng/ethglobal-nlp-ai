import express from 'express';
import { AgentController } from './api/controllers/AgentController';

async function main() {
  const app = express();
  const controller = new AgentController();

  app.use(express.json());

  // Routes
  app.post('/agents/:agentId/messages', controller.handleMessage.bind(controller));

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main().catch(console.error);