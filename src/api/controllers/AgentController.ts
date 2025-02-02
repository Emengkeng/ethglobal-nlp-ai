import { AgentLifecycleManager } from '../../infrastructure/lifecycle/AgentLifecycleManager';
import { MessageQueue } from '../../infrastructure/queue/MessageQueue';
import {ex}

export class AgentController {
  private lifecycleManager: AgentLifecycleManager;
  private messageQueue: MessageQueue;

  constructor() {
    this.lifecycleManager = new AgentLifecycleManager();
    this.messageQueue = new MessageQueue();
  }

  async handleMessage(req: Request, res: Response) {
    const { userId, message } = req.body;

    try {
      // Ensure agent is running
      const agentId = await this.lifecycleManager.handleUserActivity(userId);

      // Send message to agent
      const response = await this.sendMessageToAgent(agentId, userId, message);
      
      res.json({ success: true, response });
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  }

  private async sendMessageToAgent(agentId: string, userId: string, message: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Agent response timeout'));
      }, 30000);

      // Make the callback async
      this.messageQueue.subscribeToAgent(agentId, async (msg) => {
        if (msg.type === 'response' && msg.metadata.userId === userId) {
          clearTimeout(timeout);
          resolve(msg.payload);
        }
        // Need to return a Promise
        return Promise.resolve();
      });

      this.messageQueue.publishToAgent(agentId, {
        type: 'command',
        payload: {
          command: 'PROCESS_MESSAGE',
          userId,
          message
        }
      }).catch(reject);
    });
  }
}