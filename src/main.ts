import { SecureAgentContainer } from './infrastructure/agents/SecureAgentContainer';
import { logger } from './utils/LoggerService';
import { initializeMessageQueue } from './infrastructure/queue/messageQueueSingleton';

class AgentProcess {
  private container?: SecureAgentContainer;

  async start() {
    const userId = process.env.USER_ID;
    const agentId = process.env.AGENT_ID;

    if (!userId || !agentId) {
      throw new Error('Missing required environment variables');
    }

    // Initialize message queue first
    await initializeMessageQueue();

    this.container = new SecureAgentContainer(userId, agentId);
    await this.container.initialize();

    this.setupShutdown();

    logger.info(`Agent process started for agent ${agentId}`);
  }

  private setupShutdown() {
    process.on('SIGTERM', this.handleShutdown.bind(this));
    process.on('SIGINT', this.handleShutdown.bind(this));
  }

  private async handleShutdown(signal: string) {
    logger.info(`Received ${signal}, preparing to shutdown...`);
    try {
      await this.container?.cleanup();
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown error:', error);
      process.exit(1);
    }
  }
}

const agentProcess = new AgentProcess();
agentProcess.start().catch(error => {
  logger.error('Agent startup failed:', error);
  process.exit(1);
});