import { MessageQueue } from "./infrastructure/queue/MessageQueue";
import { TestServer } from "./server";

const server = new TestServer();
server.initialize().catch(console.error);


class TestClient {
  private messageQueue: MessageQueue;
  private readonly agentId: string;

  constructor() {
    this.agentId = process.env.AGENT_ID || 'test-agent';
    this.messageQueue = new MessageQueue(
      'amqp://localhost:5672',
      'redis://localhost:6379'
    );
  }

  async initialize() {
    await this.messageQueue.initialize();
    
    console.log(`Client ${this.agentId} initializing...`);
    
    // Subscribe to commands
    await this.messageQueue.subscribeToAgent(
      this.agentId,
      async (message) => {
        console.log('Received command:', message);
        await this.handleCommand(message);
      },
      { 
        consumerTag: `${this.agentId}-consumer`
      }
    );

    // Send ready status
    await this.sendStatus('ready');
    console.log(`Client ${this.agentId} ready`);
  }

  private async handleCommand(message: any) {
    console.log(`Processing command for ${this.agentId}:`, message);
    
    try {
      // Simulate command processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send success response
      await this.sendStatus('command_completed', {
        commandId: message.metadata?.messageId,
        result: 'Command processed successfully'
      });
    } catch (error) {
      console.error('Command processing error:', error);
      await this.sendError(error);
    }
  }

  private async sendStatus(status: string, data: any = {}) {
    await this.messageQueue.publishToAgent('server', {
      type: 'event',
      payload: {
        status,
        agentId: this.agentId,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async sendError(error: any) {
    await this.messageQueue.publishToAgent('server', {
      type: 'event',
      payload: {
        error: error.message,
        agentId: this.agentId,
        userId: this.agentId,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Start client if running directly
if (require.main === module) {
  const client = new TestClient();
  client.initialize().catch(console.error);
}