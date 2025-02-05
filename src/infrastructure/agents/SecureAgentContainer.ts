import { AgentService } from '@/services/AgentService';
import { WalletService } from '@/services/WalletService';
import { MessageQueue } from '../queue/MessageQueue';
import { QueueMessage } from '@/types';
import { HumanMessage } from '@langchain/core/messages';
import { messageQueueSingleton } from '../queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';
import { v4 as uuidv4 } from 'uuid'

export class SecureAgentContainer {
  private agent: any;
  private config: any;
  private readonly userId: string;
  private readonly agentId: string;
  private readonly instanceId: string;
  private messageQueue: MessageQueue;

  constructor(userId: string, agentId: string) {
    this.userId = userId;
    this.agentId = agentId;
    this.instanceId = uuidv4(); // Unique instance identifier
    this.messageQueue = messageQueueSingleton;
  }

  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing SecureAgentContainer`, { 
        userId: this.userId, 
        agentId: this.agentId,
        instanceId: this.instanceId
      });
  
      const { agent, config } = await AgentService.initialize();
      logger.info(`Agent initialized`, { 
        agentType: agent.constructor.name,
        configKeys: Object.keys(config) 
      });
  
      this.agent = agent;
      this.config = config;

      // Register this specific agent instance
      await messageQueueSingleton.registerAgentInstance(
        this.agentId, 
        this.instanceId
      );
  
      await this.subscribeToMessages();
      
      logger.info(`Agent container fully initialized`, { 
        userId: this.userId, 
        agentId: this.agentId,
        instanceId: this.instanceId
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
    logger.info(`Setting up message subscription`, { 
      agentId: this.agentId,
      instanceId: this.instanceId 
    });
    
    await this.messageQueue.subscribeToAgent(
      this.agentId, 
      async (message: QueueMessage) => {
      logger.info(`Received message`, { 
        type: message.type, 
        agentId: this.agentId,
        instanceId: this.instanceId
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
    },
    // {
    //   filter: (msg) => 
    //     msg.metadata.agentId === this.agentId && 
    //     msg.type === 'command'
    // }
  );
  }

  private async handleCommand(message: QueueMessage): Promise<void> {
    const { command, requestId  } = message.payload;
    
    logger.info(`Processing command`, { 
      command, 
      userId: message.payload.userId,
      requestId  
    });
  
    try {
      switch (command) {
        case 'PROCESS_MESSAGE':
          logger.info(`Executing message processing`, { 
            userId: message.payload.userId,
            messageLength: message.payload.message.length,
            requestId 
          });
          
          const response = await this.processUserMessage(
            message.payload.message,
            requestId
          );
          
          logger.info(`Message processed successfully`, {
            userId: message.payload.userId,
            responseCount: response.length,
            requestId
          });
          
          await this.sendResponse(message, response, requestId);
          break;
  
        default:
          logger.warn(`Unsupported command`, { 
            command, 
            userId: message.payload.userId 
          });
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      logger.error(`Command handling failed`, {
        command,
        userId: message.payload.userId,
        error: error,
      });
      await this.sendErrorResponse(message, error);
    }
  }

  private async handleEvent(message: QueueMessage): Promise<void> {
    const { event, requestId } = message.payload;

    switch (event) {
      case 'HEALTH_CHECK':
        await this.sendResponse(message, { status: 'healthy' }, requestId);
        break;

      default:
        logger.warn(`Unknown event: ${event}`);
    }
  }

  private async processUserMessage(message: string, requestId: string): Promise<any> {
    if (!message) {
      throw new Error('Empty message received');
    }

    logger.info(`Processing user message`, { 
      messageLength: message.length,
      requestId 
    });
  
    try {
      const stream = await this.agent.stream(
        { messages: [new HumanMessage(message)] },
        this.config
      );

      if (!stream) {
        throw new Error('Stream initialization failed');
      }
  
      const responses = [];
      for await (const chunk of stream) {
        logger.info('Processing stream chunk', { 
          chunkType: chunk && Object.keys(chunk)[0],
          requestId
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
        responseTypes: responses.map(r => r.type),
        requestId
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

  private async sendResponse(originalMessage: QueueMessage, payload: any, requestId: string): Promise<void> {
    await this.messageQueue.publishToAgent(this.agentId, {
      type: 'response',
      payload: {
        ...payload,
        requestId,
        userId: originalMessage.metadata.userId,
        //correlationId: originalMessage.payload.correlationId
      },
    });
  }

  private async sendErrorResponse(originalMessage: QueueMessage, error: any, requestId?: string): Promise<void> {
    await this.messageQueue.publishToAgent(this.agentId, {
      type: 'response',
      payload: {
        userId: this.userId,
        error: error.message || 'Unknown error',
        requestId,
        //originalMessageId: originalMessage.metadata.messageId,
        //correlationId: originalMessage.payload.correlationId 
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

  // private async importState(state: any): Promise<void> {
  //   if (state.wallet) {
  //     await WalletService.saveWalletData(state.wallet);
  //   }
  //   if (state.config) {
  //     this.config = state.config;
  //   }
  // }

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