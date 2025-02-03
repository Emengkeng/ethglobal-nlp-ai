import { Request, Response } from 'express';
import { AgentLifecycleManager } from '../../infrastructure/lifecycle/AgentLifecycleManager';
import { MessageQueue } from '../../infrastructure/queue/MessageQueue';
import { messageQueueSingleton } from '../../infrastructure/queue/messageQueueSingleton';

export class AgentController {
  private lifecycleManager: AgentLifecycleManager;
  private messageQueue: MessageQueue;

  constructor() {
    this.lifecycleManager = new AgentLifecycleManager();
    this.messageQueue = messageQueueSingleton;
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

  async killAllAgents(req: Request, res: Response) {
    try {
      // Call killAllAgents method from lifecycle manager
      const terminationResult = await this.lifecycleManager.killAllAgents();

      // Perform any additional cleanup
      await this.messageQueue.cleanup();

      res.json({
        success: terminationResult.success,
        terminated: terminationResult.terminated,
        failed: terminationResult.failed
      });
    } catch (error) {
      console.error('Error killing all agents:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to kill all agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTerminationStatus(req: Request, res: Response) {
    try {
      // Get termination status from lifecycle manager
      const status = await this.lifecycleManager.getTerminationStatus();

      res.json({
        success: true,
        status: {
          activeAgents: status.activeAgents,
          terminatedAgents: status.terminatedAgents,
          failedAgents: status.failedAgents
        }
      });
    } catch (error) {
      console.error('Error getting termination status:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve termination status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendMessageToAgent(agentId: string, userId: string, message: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Agent response timeout'));
      }, 90000);

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