import Docker from 'dockerode';
import path from 'path';
import { logger } from '@/utils/LoggerService';

export class DockerDeployment {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async buildImage(): Promise<void> {
    const buildContext = path.resolve(__dirname, '../');

    try {
      await new Promise((resolve, reject) => {
        this.docker.buildImage({
          context: buildContext,
          src: ['Dockerfile', 'package.json', 'package-lock.json', 'src/**/*']
        }, { t: 'trading-agent-image:latest' }, (error: any, stream: any) => {
          if (error) {
            reject(error);
            return;
          }

          stream.pipe(process.stdout);
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      });

      logger.info('Image built successfully');
    } catch (error) {
      logger.error('Error building image:', error);
      throw error;
    }
  }

  async deployAgent(userId: string, agentId: string) {
    try {
      // Create container config
      const container = await this.docker.createContainer({
        Image: 'trading-agent-image:latest',
        name: `${agentId}`,
        Env: [
          `USER_ID=${userId}`,
          `AGENT_ID=${agentId}`,
          `XAI_API_KEY=${process.env.XAI_API_KEY}`,
          `CDP_API_KEY_NAME=${process.env.CDP_API_KEY_NAME}`,
          `CDP_API_KEY_PRIVATE_KEY=${process.env.CDP_API_KEY_PRIVATE_KEY}`,
          `NETWORK_ID=${process.env.NETWORK_ID || 'base-sepolia'}`,
          `REDIS_URL=${process.env.REDIS_URL}`,
          `RABBITMQ_URL=${process.env.RABBITMQ_URL}`
        ],
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          MemorySwap: 1024  * 1024 * 1024,
          CpuShares: 1024,
          RestartPolicy: {
            Name: 'unless-stopped'
          },
          NetworkMode: 'host',
          LogConfig: {
            Type: 'json-file',
            Config: {
              'max-size': '10m',
              'max-file': '3'
            }
          }
        }
      });

      // Start the container
      await container.start();
      logger.info(`Agent ${agentId} deployed successfully`);

      return container.id;
    } catch (error) {
      logger.error(`Error deploying agent ${agentId}:`, error);
      throw error;
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(`trading-agent-${agentId}`);
      await container.stop();
      await container.remove();
      logger.info(`Agent ${agentId} removed successfully`);
    } catch (error) {
      logger.error(`Error removing agent ${agentId}:`, error);
      throw error;
    }
  }
}