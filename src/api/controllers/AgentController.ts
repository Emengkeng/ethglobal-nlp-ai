import { Request, Response } from 'express';
import { AgentLifecycleManager } from '../../infrastructure/lifecycle/AgentLifecycleManager';
import { MessageQueue } from '../../infrastructure/queue/MessageQueue';
import { messageQueueSingleton } from '../../infrastructure/queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';

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
      logger.info(`Handling message for user: ${userId}`);
      
      const agentId = await this.lifecycleManager.handleUserActivity(userId);
      logger.debug(`Agent ID assigned: ${agentId}`);

      const response = await this.sendMessageToAgent(agentId, userId, message);
      
      logger.info(`Message processed successfully for user: ${userId}`);
      res.json({ success: true, response });
    } catch (error) {
      logger.error('Error handling message', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      res.status(500).json({ error: 'Failed to process message' });
    }
  }

  async killAllAgents(req: Request, res: Response) {
    try {
      logger.info('Initiating kill all agents process');
      
      const terminationResult = await this.lifecycleManager.killAllAgents();
      await this.messageQueue.cleanup();
      
      logger.info('Agents termination process completed', {
        success: terminationResult.success,
        terminated: terminationResult.terminated,
        failed: terminationResult.failed
      });

      res.json({
        success: terminationResult.success,
        terminated: terminationResult.terminated,
        failed: terminationResult.failed
      });
    } catch (error) {
      logger.error('Error killing all agents', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to kill all agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getTerminationStatus(req: Request, res: Response) {
    try {
      logger.info('Retrieving termination status');
      
      const status = await this.lifecycleManager.getTerminationStatus();
      
      logger.debug('Termination status retrieved', { status });

      res.json({
        success: true,
        status: {
          activeAgents: status.activeAgents,
          terminatedAgents: status.terminatedAgents,
          failedAgents: status.failedAgents
        }
      });
    } catch (error) {
      logger.error('Error getting termination status', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve termination status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendMessageToAgent(agentId: string, userId: string, message: string): Promise<any> {
    return new Promise((resolve, reject) => {
      logger.debug(`Sending message to agent`, { agentId, userId });

      const timeout = setTimeout(() => {
        logger.warn(`Agent response timeout for agent: ${agentId}, user: ${userId}`);
        reject(new Error('Agent response timeout'));
      }, 90000);

      this.messageQueue.subscribeToAgent(agentId, async (msg) => {
        if (msg.type === 'response' && msg.metadata.userId === userId) {
          clearTimeout(timeout);
          logger.info(`Received response from agent`, { agentId, userId });
          resolve(msg.payload);
        }
        return Promise.resolve();
      });

      this.messageQueue.publishToAgent(agentId, {
        type: 'command',
        payload: {
          command: 'PROCESS_MESSAGE',
          userId,
          message
        }
      }).catch(error => {
        logger.error('Failed to publish message to agent', { 
          agentId, 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        reject(error);
      });
    });
  }
}