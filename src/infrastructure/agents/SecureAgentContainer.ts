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
      // Initialize message queue
      //await this.messageQueue.initialize();

      // Initialize agent with isolated wallet
      const { agent, config } = await AgentService.initialize();
      this.agent = agent;
      this.config = config;

      // Subscribe to agent messages
      await this.subscribeToMessages();
      
      logger.info(`Agent ${this.agentId} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize agent ${this.agentId}:`, error);
      throw error;
    }
  }

  private async subscribeToMessages(): Promise<void> {
    await this.messageQueue.subscribeToAgent(this.agentId, async (message: QueueMessage) => {
      try {
        switch (message.type) {
          case 'command':
            await this.handleCommand(message);
            break;
          case 'event':
            await this.handleEvent(message);
            break;
          default:
            logger.warn(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        logger.error(`Error processing message for agent ${this.agentId}:`, error);
        // Send error response
        await this.sendErrorResponse(message, error);
      }
    });
  }

  private async handleCommand(message: QueueMessage): Promise<void> {
    const { command, payload } = message.payload;

    switch (command) {
      case 'PROCESS_MESSAGE':
        const response = await this.processUserMessage(payload.message);
        await this.sendResponse(message, response);
        break;

      case 'SAVE_STATE':
        const state = await this.exportState();
        await this.sendResponse(message, { state });
        break;

      case 'LOAD_STATE':
        await this.importState(payload.state);
        await this.sendResponse(message, { success: true });
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
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
    const stream = await this.agent.stream(
      { messages: [new HumanMessage(message)] },
      this.config
    );

    const responses = [];
    for await (const chunk of stream) {
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
    return responses;
  }

  private async sendResponse(originalMessage: QueueMessage, payload: any): Promise<void> {
    await this.messageQueue.publishToAgent(this.agentId, {
      type: 'response',
      payload: {
        ...payload,
        originalMessageId: originalMessage.metadata.messageId
      }
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