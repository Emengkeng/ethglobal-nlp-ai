import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/LoggerService';


export interface QueueMessage {
  type: 'command' | 'response' | 'event';
  payload: any;
  metadata: {
    userId: string;
    agentId: string;
    timestamp: number;
    messageId: string;
  };
}

export class MessageQueue {
  private connection?: Connection;
  public channel?: Channel;
  private readonly exchangeName = 'trading-agents';
  private readonly mainExchangeName = 'trading-agents-advanced';
  private readonly deadLetterExchangeName = 'trading-agents-dlx';

  // Load balancing configuration
  private agentPools: Map<string, string[]> = new Map();
  private agentLoadMetrics: Map<string, number> = new Map();
  
  constructor(
    private readonly url: string = process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672'
  ) {}

  async initialize(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      // Setup main exchange
      await this.channel.assertExchange(this.mainExchangeName, 'topic', { 
        durable: true,
        arguments: {
          'x-ha-policy': 'all' // Enable queue mirroring for high availability
        }
      });

      // Setup dead-letter exchange
      await this.channel.assertExchange(this.deadLetterExchangeName, 'topic', { durable: true });
      
      this.setupConnectionRecovery();
    } catch (error) {
      logger.error('Failed to initialize message queue:', error);
      throw error;
    }
  }

  private setupConnectionRecovery() {
    if (!this.connection) return;

    this.connection.on('close', async () => {
      logger.warn('Connection closed, initiating intelligent reconnection');
      await this.intelligentReconnect();
    });

    this.connection.on('error', (err) => {
      logger.error('RabbitMQ Connection Error:', err);
    });
  }

  async reconnect(retries = 5): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.initialize();
        return;
      } catch (error) {
        logger.error(`Reconnection attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error('Failed to reconnect to message queue');
  }

  async subscribeToAgent(
    agentId: string, 
    callback: (msg: QueueMessage) => Promise<void>,
    options?: { consumerTag?: string }
  ): Promise<string> {
    if (!this.channel) throw new Error('Queue not initialized');

    logger.info('Subscribing to agent queue', { 
      agentId, 
      queueName: `agent.${agentId}`,
      routingKey: `agent.${agentId}.*`
    });
  
    const queueName = `agent.${agentId}`;
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, this.exchangeName, `agent.${agentId}.*`);
  
    const { consumerTag } = await this.channel.consume(
      queueName, 
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        
        try {
          const message: QueueMessage = JSON.parse(msg.content.toString());
          await callback(message);
          this.channel?.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          
          if (error instanceof SyntaxError) {
            this.channel?.reject(msg, false);
          } else {
            this.channel?.nack(msg, false, !msg.fields.redelivered);
          }
        }
      },
      { 
        consumerTag: options?.consumerTag 
      }
    );
  
    return consumerTag;
  }

  async unsubscribeFromAgent(agentId: string, consumerTag: string): Promise<void> {
    if (!this.channel) throw new Error('Queue not initialized');
    
    try {
      await this.channel.cancel(consumerTag);
      logger.info(`Unsubscribed from agent queue`, { agentId, consumerTag });
    } catch (error) {
      logger.error(`Error unsubscribing from agent queue`, { agentId, consumerTag, error });
      throw error;
    }
  }

  async publishToAgent(agentId: string, message: Omit<QueueMessage, 'metadata'> & { payload: { userId: string } }) {
    if (!this.channel) throw new Error('Queue not initialized');

    const fullMessage: QueueMessage = {
      ...message,
      metadata: {
        userId: message.payload.userId,
        agentId,
        timestamp: Date.now(),
        messageId: Math.random().toString(36).substring(7)
      }
    };

    const routingKey = `agent.${agentId}.${message.type}`;
    const published = this.channel.publish(
      this.exchangeName,
      routingKey,
      Buffer.from(JSON.stringify(fullMessage)),
      { persistent: true }
    );

    if (!published) {
      throw new Error('Message could not be published to the queue');
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = undefined;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = undefined;
      }

      logger.info('Message queue connections closed');
    } catch (error) {
      logger.error('Error cleaning up message queue:', error);
      throw error;
    }
  }
}