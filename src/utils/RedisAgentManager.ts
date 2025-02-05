import Redis from 'ioredis';
import { logger } from '@/utils/LoggerService';

export class RedisAgentManager {
  private redis: Redis;
  private readonly AGENT_POOLS_KEY = 'agent:pools';
  private readonly AGENT_LOAD_KEY = 'agent:load';

  constructor(
    private readonly redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });

    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Successfully connected to Redis');
    });
  }

  // Agent Pool Management
  async addAgentToPool(agentId: string, instanceId: string): Promise<void> {
    try {
      const key = `${this.AGENT_POOLS_KEY}:${agentId}`;
      await this.redis.sadd(key, instanceId);
      logger.info('Added agent instance to pool', { agentId, instanceId });
    } catch (error) {
      logger.error('Error adding agent to pool:', error);
      throw error;
    }
  }

  async removeAgentFromPool(agentId: string, instanceId: string): Promise<void> {
    try {
      const key = `${this.AGENT_POOLS_KEY}:${agentId}`;
      await this.redis.srem(key, instanceId);
      logger.info('Removed agent instance from pool', { agentId, instanceId });
    } catch (error) {
      logger.error('Error removing agent from pool:', error);
      throw error;
    }
  }

  async getAgentPool(agentId: string): Promise<string[]> {
    try {
      const key = `${this.AGENT_POOLS_KEY}:${agentId}`;
      const pool = await this.redis.smembers(key);
      return pool;
    } catch (error) {
      logger.error('Error getting agent pool:', error);
      throw error;
    }
  }

  // Load Metrics Management
  async updateAgentLoad(instanceId: string, load: number): Promise<void> {
    try {
      const key = `${this.AGENT_LOAD_KEY}:${instanceId}`;
      await this.redis.set(key, load.toString());
      // Set expiry to clean up inactive agents (e.g., 1 hour)
      await this.redis.expire(key, 3600);
    } catch (error) {
      logger.error('Error updating agent load:', error);
      throw error;
    }
  }

  async incrementAgentLoad(instanceId: string): Promise<number> {
    try {
      const key = `${this.AGENT_LOAD_KEY}:${instanceId}`;
      const newLoad = await this.redis.incr(key);
      await this.redis.expire(key, 3600);
      return newLoad;
    } catch (error) {
      logger.error('Error incrementing agent load:', error);
      throw error;
    }
  }

  async decrementAgentLoad(instanceId: string): Promise<number> {
    try {
      const key = `${this.AGENT_LOAD_KEY}:${instanceId}`;
      const newLoad = await this.redis.decr(key);
      await this.redis.expire(key, 3600);
      return Math.max(0, newLoad);
    } catch (error) {
      logger.error('Error decrementing agent load:', error);
      throw error;
    }
  }

  async getAgentLoad(instanceId: string): Promise<number> {
    try {
      const key = `${this.AGENT_LOAD_KEY}:${instanceId}`;
      const load = await this.redis.get(key);
      return load ? parseInt(load, 10) : 0;
    } catch (error) {
      logger.error('Error getting agent load:', error);
      throw error;
    }
  }

  async getBestAgentInstance(agentId: string): Promise<string> {
    try {
      const pool = await this.getAgentPool(agentId);
      
      if (!pool || pool.length === 0) {
        throw new Error(`No agent instances available for ${agentId}`);
      }

      // Get load for all instances in parallel
      const loadPromises = pool.map(async instanceId => ({
        instanceId,
        load: await this.getAgentLoad(instanceId)
      }));

      const instanceMetrics = await Promise.all(loadPromises);

      return instanceMetrics.reduce((min, current) => 
        current.load < min.load ? current : min
      ).instanceId;
    } catch (error) {
      logger.error('Error getting best agent instance:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error cleaning up Redis connection:', error);
      throw error;
    }
  }
}