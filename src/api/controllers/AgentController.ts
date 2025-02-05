import { Request, Response } from 'express';
import { AgentLifecycleManager } from '../../infrastructure/lifecycle/AgentLifecycleManager';
import { MessageQueue } from '../../infrastructure/queue/MessageQueue';
import { messageQueueSingleton } from '../../infrastructure/queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';
import { v4 as uuidv4 } from 'uuid';

export class AgentController {
  private lifecycleManager: AgentLifecycleManager;
  private messageQueue: MessageQueue;

  constructor() {
    this.lifecycleManager = new AgentLifecycleManager();
    this.messageQueue = messageQueueSingleton;
  }

  async handleMessage(req: Request, res: Response) {
    const { userId, message, priority = 'medium' } = req.body;

    try {
      logger.info(`Handling message for user: ${userId}`, { priority });
      
      const agentId = await this.lifecycleManager.handleUserActivity(userId);
      logger.info(`Agent ID assigned: ${agentId}`);

      // Generate a unique request ID for comprehensive tracking
      const requestId = uuidv4();

      // Use message queue with priority and request tracking
      const responsePromise = this.waitForAgentResponse(agentId, userId, requestId);

      // Publish message with routing
      await messageQueueSingleton.publishToAgent(agentId, {
        type: 'command',
        payload: {
          command: 'PROCESS_MESSAGE',
          userId,
          message,
          requestId,
          priority
        }
      });

      // Wait for response with timeout
      const response = await Promise.race([
        responsePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Agent response timeout')), 30000)
        )
      ]);

      //const response = await this.sendMessageToAgent(agentId, userId, message);
      
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

  async createAgent(req: Request, res: Response) {
    const { userId } = req.body;

    try {
      logger.info(`Creating Agent for user: ${userId}`);
      
      const agentId = await this.lifecycleManager.createAgent(userId);
      logger.info(`Agent ID assigned: ${agentId}`);

      // Register agent instance with message queue
      await messageQueueSingleton.registerAgentInstance(agentId, uuidv4());

      //const response = await this.sendMessageToAgent(agentId, userId);
      
      logger.info(`Agent created successfully for user: ${userId}`);
      res.json({ success: true, agentId });
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
      
      logger.info('Termination status retrieved', { status });

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

  // private async sendMessageToAgent(agentId: string, userId: string, message: string): Promise<any> {
  //   return new Promise(async (resolve, reject) => {
  //     logger.info(`Starting message send process`, { agentId, userId });
      
  //     const timeout = setTimeout(() => {
  //       logger.error(`Timeout reached for agent response`, { agentId, userId });
  //       reject(new Error('Agent response timeout'));
  //     }, 90000);
  
  //     try {
  //       // Verify queue connection
  //       if (!this.messageQueue.channel) {
  //         logger.error(`No channel available`, { agentId, userId });
  //         await this.messageQueue.initialize();
  //       }
  
  //       // Create unique correlation ID for this request
  //       const correlationId = Math.random().toString(36).substring(7);
  //       logger.info(`Generated correlation ID: ${correlationId}`);
  
  //       // Create a unique consumer tag to ensure this specific subscription
  //       const consumerTag = `${agentId}-${userId}-${correlationId}`;
  
  //       await this.messageQueue.subscribeToAgent( agentId, async (msg) => {
  //           logger.info(`AGENT: Received message from agent`, { 
  //             type: msg.type, 
  //             receivedUserId: msg.metadata.userId,
  //             expectedUserId: userId,
  //             correlationId: msg.payload?.correlationId
  //           });
  
  //           // More precise matching with correlationId
  //           if (
  //             msg.type === 'response' && 
  //             msg.metadata.userId === userId && 
  //             msg.payload?.correlationId === correlationId
  //           ) {
  //             clearTimeout(timeout);
  //             logger.info(`Matched response received`, { agentId, userId, correlationId });
              
  //             // Unsubscribe to prevent further message processing
  //             await this.messageQueue.unsubscribeFromAgent(agentId, consumerTag);
              
  //             resolve(msg.payload);
  //           }
  //           return Promise.resolve();
  //         },
  //         { consumerTag }  // Pass the unique consumer tag
  //       );
  
  //       logger.info(`Subscription created`, { agentId, consumerTag });
  
  //       await this.messageQueue.publishToAgent(agentId, {
  //         type: 'command',
  //         payload: {
  //           command: 'PROCESS_MESSAGE',
  //           userId,
  //           message,
  //           correlationId  // Include correlation ID in payload
  //         }
  //       });
  
  //       logger.info(`Message published`, { agentId, userId, correlationId });
  
  //     } catch (error) {
  //       logger.error(`Error in message flow`, { 
  //         agentId, 
  //         userId, 
  //         error: error instanceof Error ? error.message : 'Unknown error'
  //       });
  //       clearTimeout(timeout);
  //       reject(error);
  //     }
  //   });
  // }

  private async waitForAgentResponse(agentId: string, userId: string, requestId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const handleResponse = async (msg: any) => {
        try {
          // Precise matching with requestId
          if (
            msg.type === 'response' && 
            msg.metadata.userId === userId && 
            msg.payload.requestId === requestId
          ) {
            resolve(msg.payload);
          }
        } catch (error) {
          reject(error);
        }
      };

      // Subscribe to responses for this specific agent
      messageQueueSingleton.subscribeToAgent(
        agentId, 
        handleResponse,
        { 
          filter: (msg) => 
            msg.type === 'response' && 
            msg.payload.requestId === requestId 
        }
      );
    });
  }
}