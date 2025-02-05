import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/LoggerService';
import { QueueMessage, SubscriptionOptions } from '@/types';
import { RedisAgentManager } from '@/utils/RedisAgentManager';

export class MessageQueue {
  private connection?: Connection;
  public channel?: Channel;
  //private readonly exchangeName = 'trading-agents';
  private readonly mainExchangeName = 'trading-agents-advanced';
  private readonly deadLetterExchangeName = 'trading-agents-dlx';
  private redisAgentManager: RedisAgentManager;

  // Load balancing configuration
  private agentPools: Map<string, string[]> = new Map();
  private agentLoadMetrics: Map<string, number> = new Map();
  
  constructor(
    private readonly url: string = process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672',
    private readonly redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.redisAgentManager = new RedisAgentManager(redisUrl);
  }

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

  async intelligentReconnect(maxRetries = 5): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        
        await this.initialize();
        
        // Reestablish all agent subscriptions
        for (const [agentId, pool] of this.agentPools.entries()) {
          await Promise.all(
            pool.map(agentInstanceId => 
              this.registerAgentInstance(agentId, agentInstanceId)
            )
          );
        }

        logger.info('Intelligent reconnection successful');
        return;
      } catch (error) {
        logger.error(`Reconnection attempt ${attempt + 1} failed:`, error);
      }
    }
    
    throw new Error('Failed to reconnect to message queue after multiple attempts');
  }

  // Dynamic agent pool management
  async registerAgentInstance(agentId: string, instanceId: string): Promise<void> {
    if (!this.agentPools.has(agentId)) {
      this.agentPools.set(agentId, []);
    }

    const pool = this.agentPools.get(agentId)!;
    if (!pool.includes(instanceId)) {
      pool.push(instanceId);
    }

    // Setup queue for this specific agent instance
    //const queueName = `agent.${agentId}.${instanceId}`;
    const queueName = `agent.${agentId}.${instanceId}`;
    
    if (!this.channel) throw new Error('Channel not initialized');

    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.deadLetterExchangeName,
        'x-message-ttl': 60000, // 1-minute message timeout
        'x-max-priority': 10    // Support priority messaging
      }
    });

    await this.channel.bindQueue(queueName, this.mainExchangeName, `agent.${agentId}.#`);
  }

  async selectBestAgentInstance(agentId: string): Promise<string> {
    const pool = this.agentPools.get(agentId);
    if (!pool || pool.length === 0) {
      throw new Error(`No agent instances available for ${agentId}`);
    }

    // Select instance with least current load
    const instanceMetrics = pool.map(instanceId => ({
      instanceId,
      load: this.agentLoadMetrics.get(instanceId) || 0
    }));

    return instanceMetrics.reduce((min, current) => 
      current.load < min.load ? current : min
    ).instanceId;
  }

  async publishToAgent(
    agentId: string, 
    message: Omit<QueueMessage, 'metadata'> & { payload: { userId: string } }
  ) {
    if (!this.channel) throw new Error('Queue not initialized');

    // Select best agent instance for load balancing
    const selectedInstanceId = await this.selectBestAgentInstance(agentId);

    const fullMessage: QueueMessage = {
      ...message,
      metadata: {
        userId: message.payload.userId,
        instanceId: message.payload.instanceId,
        agentId,
        timestamp: Date.now(),
        messageId: uuidv4(),
        priority: message.payload.priority || 'medium',
        attempts: 0
      }
    };

    const routingKey =  message.payload?.instanceId
      ? `agent.${agentId}.${message.payload.instanceId}.${message.type}`
      : `agent.${agentId}.${message.type}`;
      
    const published = this.channel.publish(
      this.mainExchangeName,
      routingKey,
      Buffer.from(JSON.stringify(fullMessage)),
      { 
        persistent: true,
        priority: this.getPriorityNumber(fullMessage.metadata.priority)
      }
    );

    if (!published) {
      throw new Error('Message could not be published to the queue');
    }

    // Update load metrics
    this.agentLoadMetrics.set(selectedInstanceId, 
      (this.agentLoadMetrics.get(selectedInstanceId) || 0) + 1
    );
  }

  private getPriorityNumber(priority: string): number {
    switch(priority) {
      case 'high': return 9;
      case 'medium': return 5;
      case 'low': return 1;
      default: return 5;
    }
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
    options?: SubscriptionOptions
  ): Promise<string> {
    if (!this.channel) throw new Error('Queue not initialized');

    logger.info('Subscribing to agent queue', { 
      agentId, 
      queueName: `agent.${agentId}`,
      routingKey: `agent.${agentId}.#`
    });
  
    const queueName = options?.consumerTag 
      ? `agent.${agentId}.${options.consumerTag}`
      : `agent.${agentId}`;


    logger.info('passed queue Name')
    await this.channel.assertQueue(queueName, { 
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.deadLetterExchangeName,
        'x-message-ttl': 60000
      }
    });
    logger.info('passed assertQueue')

    // More specific routing key pattern to avoid error
    const routingKey = options?.consumerTag 
      ? `agent.${agentId}.${options.consumerTag}.#`
      : `agent.${agentId}.#`;

    await this.channel.bindQueue(queueName, this.mainExchangeName, routingKey);

  
    logger.info('Starting message consumtion')
    const { consumerTag } = await this.channel.consume(
      queueName, 
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          logger.warn('Received null message after subscribing to agent queue', { queueName });
          return}
        ;
        
        try {
          logger.info('Processing message', { 
            queueName, 
            contentLength: msg.content.length 
          });

          const message: QueueMessage = JSON.parse(msg.content.toString());

          logger.info('Parsed message', { 
            messageType: message.type,
            agentId 
          });

          if (!options?.filter || options.filter(message)) {

            logger.info('Executing message callback', { 
              messageType: message.type,
              agentId 
            });

            await callback(message);
            this.channel?.ack(msg);
            logger.info('Message processed successfully', { agentId });
          } else {
            // If message doesn't pass filter, reject without requeue
            logger.warn('Message filtered out', { 
              messageType: message.type,
              agentId 
            });
            this.channel?.reject(msg, false);
          }
        } catch (error) {
          logger.error('Error processing message', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            queueName,
            agentId
          });
          
          if (msg) {
            if (error instanceof SyntaxError) {
              logger.error('Syntax error parsing message', { agentId });
              this.channel?.reject(msg, false);
            } else {
              logger.error('Message processing error', { 
                agentId,
                redelivered: !msg.fields.redelivered 
              });
              this.channel?.nack(msg, false, !msg.fields.redelivered);
            }
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

   // Dead letter handling for failed messages
   async setupDeadLetterHandling() {
    if (!this.channel) throw new Error('Channel not initialized');

    const deadLetterQueue = 'dead-letter-queue';
    await this.channel.assertQueue(deadLetterQueue, { durable: true });

    await this.channel.bindQueue(
      deadLetterQueue, 
      this.deadLetterExchangeName, 
      '#'
    );

    await this.channel.consume(deadLetterQueue, async (msg) => {
      if (!msg) return;

      try {
        const message: QueueMessage = JSON.parse(msg.content.toString());
        
        // Implement retry or error handling logic
        if (message.metadata.attempts < 3) {
          // Retry message
          message.metadata.attempts++;
          await this.publishToAgent(message.metadata.agentId, message);
        } else {
          // Permanent failure logging
          logger.error('Permanently failed message', { 
            message,
            reason: 'Max retry attempts reached' 
          });
        }

        this.channel?.ack(msg);
      } catch (error) {
        logger.error('Dead letter processing error', error);
        this.channel?.nack(msg, false, false);
      }
    });
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

      logger.info('Advanced message queue connections closed');
    } catch (error) {
      logger.error('Error cleaning up advanced message queue:', error);
      throw error;
    }
  }
}