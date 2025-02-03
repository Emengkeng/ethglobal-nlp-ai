import { SecureAgentContainer } from './infrastructure/agents/SecureAgentContainer';
import { logger } from '@/utils/LoggerService';


class AgentProcess {
  private container?: SecureAgentContainer;

  async start() {
    const userId = process.env.USER_ID;
    const agentId = process.env.AGENT_ID;

    if (!userId || !agentId) {
      throw new Error('Missing required environment variables');
    }

    this.container = new SecureAgentContainer(userId, agentId);
    await this.container.initialize();

    this.setupShutdown();
  }

  private setupShutdown() {
    // Graceful shutdown handlers
    process.on('SIGTERM', this.handleShutdown.bind(this));
    process.on('SIGINT', this.handleShutdown.bind(this));
    
    // Uncaught error handlers
    process.on('uncaughtException', this.handleError.bind(this));
    process.on('unhandledRejection', this.handleError.bind(this));
  }

  private async handleShutdown(signal: string) {
    logger.info(`Received ${signal} signal, preparing for shutdown...`);
    try {
      // Cleanup tasks
      await this.container?.cleanup();
      logger.info('Cleanup completed, shutting down...');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  private async handleError(error: Error) {
    logger.error('Unhandled error:', error);
    await this.handleShutdown('ERROR');
  }
}

// Start the agent process
const agentProcess = new AgentProcess();
agentProcess.start().catch(error => {
  logger.error('Failed to start agent container:', error);
  process.exit(1);
});