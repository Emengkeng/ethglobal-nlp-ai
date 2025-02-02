import amqp, { Channel, Connection } from 'amqplib';

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
  private channel?: Channel;
  private readonly exchangeName = 'trading-agents';
  
  constructor(
    private readonly url: string = process.env.RABBITMQ_URL || 'amqp://localhost'
  ) {}

  async initialize(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    
    // Create exchange for pub/sub
    await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
    
    // Handle reconnection
    this.connection.on('close', async () => {
      console.log('Connection closed, reconnecting...');
      await this.reconnect();
    });
  }

  async reconnect(retries = 5): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.initialize();
        return;
      } catch (error) {
        console.error(`Reconnection attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error('Failed to reconnect to message queue');
  }

  async subscribeToAgent(agentId: string, callback: (msg: QueueMessage) => Promise<void>) {
    if (!this.channel) throw new Error('Queue not initialized');

    const queueName = `agent.${agentId}`;
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(queueName, this.exchangeName, `agent.${agentId}.*`);

    await this.channel.consume(queueName, async (msg: { content: { toString: () => string; }; fields: { redelivered: any; }; }) => {
      if (!msg) return;
      
      try {
        const message: QueueMessage = JSON.parse(msg.content.toString());
        await callback(message);
        this.channel?.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        // Requeue only if not processed
        this.channel?.nack(msg, false, !msg.fields.redelivered);
      }
    });
  }

  async publishToAgent(agentId: string, message: Omit<QueueMessage, 'metadata'>) {
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

    await this.channel.publish(
      this.exchangeName,
      `agent.${agentId}.${message.type}`,
      Buffer.from(JSON.stringify(fullMessage)),
      { persistent: true }
    );
  }
}