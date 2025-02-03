import { AgentService } from '@/services/AgentService';
import { WalletService } from '@/services/WalletService';
import { MessageQueue, QueueMessage } from '../queue/MessageQueue';
import { HumanMessage } from '@langchain/core/messages';
import { messageQueueSingleton } from '../queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';

export class SecureAgentContainer {
  private agent: any;
  private config: any;
  private readonly userId: string;
  private readonly agentId: string;
  private messageQueue: MessageQueue;

  constructor(userId: string, agentId: string) {
    this.userId = userId;
    this.agentId = agentId;
    this.messageQueue = messageQueueSingleton;
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing SecureAgentContainer`, { 
        userId: this.userId, 
        agentId: this.agentId 
      });
  
      const { agent, config } = await AgentService.initialize();
      logger.debug(`Agent initialized`, { 
        agentType: agent.constructor.name,
        configKeys: Object.keys(config) 
      });
  
      this.agent = agent;
      this.config = config;
  
      await this.subscribeToMessages();
      
      logger.info(`Agent container fully initialized`, { 
        userId: this.userId, 
        agentId: this.agentId 
      });
    } catch (error) {
      logger.error(`Initialization failed`, { 
        userId: this.userId, 
        agentId: this.agentId, 
        error: error 
      });
      throw error;
    }
  }

  private async subscribeToMessages(): Promise<void> {
    logger.info(`Setting up message subscription`, { agentId: this.agentId });
    
    await this.messageQueue.subscribeToAgent(this.agentId, async (message: QueueMessage) => {
      logger.debug(`Received message`, { 
        type: message.type, 
        agentId: this.agentId 
      });
  
      try {
        switch (message.type) {
          case 'command':
            await this.handleCommand(message);
            break;
          case 'event':
            await this.handleEvent(message);
            break;
          default:
            logger.warn(`Unrecognized message type`, { 
              type: message.type, 
              agentId: this.agentId 
            });
        }
      } catch (error) {
        logger.error(`Message processing error`, { 
          agentId: this.agentId, 
          messageType: message.type, 
          error: error 
        });
        await this.sendErrorResponse(message, error);
      }
    });
  }

  private async handleCommand(message: QueueMessage): Promise<void> {
    const { command, payload } = message.payload;
    
    logger.info(`Processing command`, { 
      command, 
      userId: payload.userId,
      correlationId: payload.correlationId 
    });
  
    try {
      switch (command) {
        case 'PROCESS_MESSAGE':
          logger.debug(`Executing message processing`, { 
            userId: payload.userId,
            messageLength: payload.message.length,
            correlationId: payload.correlationId 
          });
          
          const response = await this.processUserMessage(payload.message);
          
          logger.info(`Message processed successfully`, {
            userId: payload.userId,
            responseCount: response.length,
            correlationId: payload.correlationId
          });
          
          await this.sendResponse(message, response);
          break;
  
        default:
          logger.warn(`Unsupported command`, { 
            command, 
            userId: payload.userId 
          });
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      logger.error(`Command handling failed`, {
        command,
        userId: payload.userId,
        error: error,
      });
      await this.sendErrorResponse(message, error);
    }
  }

  private async handleEvent(message: QueueMessage): Promise<void> {
    const { event } = message.payload;

    switch (event) {
      case 'HEALTH_CHECK':
        await this.sendResponse(message, { status: 'healthy' });
        break;

      default:
        logger.warn(`Unknown event: ${event}`);
    }
  }

  private async processUserMessage(message: string): Promise<any> {
    logger.info(`Processing user message`, { 
      messageLength: message.length 
    });
  
    try {
      const stream = await this.agent.stream(
        { messages: [new HumanMessage(message)] },
        this.config
      );
  
      const responses = [];
      for await (const chunk of stream) {
        logger.debug('Processing stream chunk', { 
          chunkType: chunk && Object.keys(chunk)[0] 
        });
        
        if ('agent' in chunk) {
          responses.push({
            type: 'agent',
            content: chunk.agent.messages[0].content
          });
        } else if ('tools' in chunk) {
          responses.push({
            type: 'tools',
            content: chunk.tools.messages[0].content
          });
        }
      }
      
      logger.info(`Message processing completed`, { 
        responseCount: responses.length,
        responseTypes: responses.map(r => r.type)
      });
  
      return responses;
    } catch (error) {
      logger.error('Comprehensive message processing error', {
        message,
        error: error,
      });
      throw error;
    }
  }

  private async sendResponse(originalMessage: QueueMessage, payload: any): Promise<void> {
    await this.messageQueue.publishToAgent(this.agentId, {
      type: 'response',
      payload: {
        ...payload,
        originalMessageId: originalMessage.metadata.messageId,
        userId: originalMessage.metadata.userId
      },
    });
  }

  private async sendErrorResponse(originalMessage: QueueMessage, error: any): Promise<void> {
    await this.messageQueue.publishToAgent(this.agentId, {
      type: 'response',
      payload: {
        userId: this.userId, // Add the userId to the payload
        error: error.message || 'Unknown error',
        originalMessageId: originalMessage.metadata.messageId
      }
    });
  }

  private async exportState(): Promise<{ wallet: string; config: any, timestamp: Number }> {
    const walletData = await WalletService.loadWalletData();
    return {
      wallet: walletData || '',
      config: this.config,
      timestamp: Date.now()
    };
  }

  private async importState(state: any): Promise<void> {
    if (state.wallet) {
      await WalletService.saveWalletData(state.wallet);
    }
    if (state.config) {
      this.config = state.config;
    }
  }
  async cleanup(): Promise<void> {
    try {
      // Save current state
      const state = await this.exportState();
      await WalletService.saveWalletData(state.wallet);

      // Close message queue connections
      await this.messageQueue.cleanup();

      logger.info('Agent container cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}