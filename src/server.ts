import { MessageQueue } from './infrastructure/queue/MessageQueue';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DockerDeployment } from './deployment/DockerDeployment';
const app = express();
app.use(express.json());

export class TestServer {
  private messageQueue: MessageQueue;
  private activeAgents: Map<string, string> = new Map();

  constructor() {
    this.messageQueue = new MessageQueue(
      'amqp://localhost:5672',  // Local RabbitMQ
      'redis://localhost:6379'   // Local Redis
    );
    this.setupEndpoints();
  }

  private setupEndpoints() {
    app.post('/deploy', async (req, res) => {
      try {
        const { userId } = req.body;
        const agentId = await this.deployAgent(userId);
        res.json({ success: true, agentId });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    app.post('/command', async (req, res) => {
      try {
        const { agentId, command } = req.body;
        await this.sendCommand(agentId, command);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  async initialize() {
    await this.messageQueue.initialize();
    
    // Subscribe to all agent responses
    await this.messageQueue.subscribeToAgent(
      'server',
      async (message) => {
        console.log('Received agent response:', message);
      },
      { consumerTag: 'server-consumer' }
    );

    app.listen(3000, () => {
      console.log('Test server running on port 3000');
    });
  }

  private async deployAgent(userId: string) {
    const dockerDeployment = new DockerDeployment();
    const agentId = `agent-${Date.now()}`;
    
    try {
      const containerId = await dockerDeployment.deployAgent(userId, agentId);
      this.activeAgents.set(agentId, containerId);
      await this.messageQueue.registerAgentInstance(agentId, containerId);
      return agentId;
    } catch (error) {
      console.error('Failed to deploy agent:', error);
      throw error;
    }
  }

  private async sendCommand(agentId: string, command: any) {
    await this.messageQueue.publishToAgent(agentId, {
      type: 'command',
      payload: {
        ...command,
        userId: 'test-user',
        instanceId: this.activeAgents.get(agentId)
      }
    });
  }
}