import Docker from 'dockerode';
import { MessageQueue } from '../queue/MessageQueue';
import Redis, { Redis as RedisClient } from 'ioredis';
import { DockerDeployment } from '@/deployment/DockerDeployment';

interface AgentState {
  userId: string;
  agentId: string;
  status: 'active' | 'frozen' | 'starting' | 'stopping' | 'error';
  lastActivity: Date;
  containerId?: string;
  createdAt: Date;
  lastFrozen?: Date;
  lastUnfrozen?: Date;
  errorMessage?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'An unknown error occurred';
}

export class AgentLifecycleManager {
  private docker: Docker;
  private redis: RedisClient;
  private messageQueue: MessageQueue;
  private dockerDeployment: DockerDeployment;


  // Configurable timeouts
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly STARTUP_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute

  constructor() {
    this.docker = new Docker();
    this.redis = new Redis(process.env.REDIS_URL);
    this.messageQueue = new MessageQueue();

    this.dockerDeployment = new DockerDeployment();
    
    // Start monitoring systems
    this.startActivityMonitor();
    this.startHealthCheck();
  }

  async handleUserActivity(userId: string): Promise<string> {
    // Get or create agent for user
    const agentState = await this.getAgentState(userId);
    
    if (!agentState) {
      // New user signup - create agent
      return this.createAgent(userId);
    }

    if (agentState.status === 'frozen') {
      // User returning - unfreeze agent
      return this.unfreezeAgent(agentState);
    }

    if (agentState.status === 'error') {
      // Agent in error state - attempt recovery
      return this.recoverAgent(agentState);
    }

    // Update last activity timestamp
    await this.updateAgentActivity(agentState.agentId);
    return agentState.agentId;
  }

  private async createAgent(userId: string): Promise<string> {
    console.log(`Creating new agent for user ${userId}`);
    const agentId = `agent-${userId}-${Date.now()}`;
    
    try {
      const containerId = await this.dockerDeployment.deployAgent(userId, agentId);

      const state: AgentState = {
        userId,
        agentId,
        status: 'starting',
        lastActivity: new Date(),
        containerId: containerId,
        createdAt: new Date()
      };

      await this.saveAgentState(state);

      // Wait for agent to be ready
      await this.waitForAgentReady(agentId);
      
      state.status = 'active';
      await this.saveAgentState(state);

      console.log(`Agent ${agentId} created successfully`);
      return agentId;
    } catch (error) {
      console.error(`Error creating agent for user ${userId}:`, error);
      throw error;
    }
  }

  private async freezeAgent(agentState: AgentState): Promise<void> {
    console.log(`Freezing agent ${agentState.agentId}`);
    if (agentState.status !== 'active') return;

    try {
      // Update state to stopping
      agentState.status = 'stopping';
      await this.saveAgentState(agentState);

      // Send state save command to agent
      await this.messageQueue.publishToAgent(agentState.agentId, {
        type: 'command',
        payload: {
          command: 'SAVE_STATE',
          userId: agentState.userId
        }
      });

      // Wait for state to be saved
      await this.waitForAgentResponse(agentState.agentId, 'SAVE_STATE');

      // Stop the container
      const container = this.docker.getContainer(agentState.containerId!);
      await container.stop();

      // Update state to frozen
      agentState.status = 'frozen';
      agentState.lastFrozen = new Date();
      await this.saveAgentState(agentState);

      console.log(`Agent ${agentState.agentId} frozen successfully`);
    } catch (error: unknown) {
      console.error(`Error freezing agent ${agentState.agentId}:`, error);
      // Mark agent as error state
      agentState.status = 'error';
      agentState.errorMessage = getErrorMessage(error);
      await this.saveAgentState(agentState);
    }
  }

  private async unfreezeAgent(agentState: AgentState): Promise<string> {
    console.log(`Unfreezing agent ${agentState.agentId}`);
    try {
      // Update state to starting
      agentState.status = 'starting';
      await this.saveAgentState(agentState);

      // Start the container
      const container = this.docker.getContainer(agentState.containerId!);
      await container.start();

      // Wait for agent to be ready
      await this.waitForAgentReady(agentState.agentId);

      // Restore agent state
      await this.messageQueue.publishToAgent(agentState.agentId, {
        type: 'command',
        payload: {
          command: 'LOAD_STATE',
          userId: agentState.userId
        }
      });

      // Wait for state to be restored
      await this.waitForAgentResponse(agentState.agentId, 'LOAD_STATE');

      // Update state to active
      agentState.status = 'active';
      agentState.lastActivity = new Date();
      agentState.lastUnfrozen = new Date();
      await this.saveAgentState(agentState);

      console.log(`Agent ${agentState.agentId} unfrozen successfully`);
      return agentState.agentId;
    } catch (error: unknown) {
      console.error(`Error unfreezing agent ${agentState.agentId}:`, error);
      // Mark agent as error state
      agentState.status = 'error';
      agentState.errorMessage = getErrorMessage(error);
      await this.saveAgentState(agentState);
      throw error;
    }
  }

  private async recoverAgent(agentState: AgentState): Promise<string> {
    console.log(`Attempting to recover agent ${agentState.agentId}`);
    try {
      // Remove old container
      const oldContainer = this.docker.getContainer(agentState.containerId!);
      await oldContainer.remove({ force: true });

      // Create new container
      return await this.createAgent(agentState.userId);
    } catch (error) {
      console.error(`Error recovering agent ${agentState.agentId}:`, error);
      throw error;
    }
  }

  private async startActivityMonitor(): Promise<void> {
    setInterval(async () => {
      try {
        const agents = await this.getAllAgentStates();
        const now = new Date();

        for (const agent of agents) {
          if (agent.status !== 'active') continue;

          const inactiveTime = now.getTime() - new Date(agent.lastActivity).getTime();
          if (inactiveTime > this.INACTIVITY_TIMEOUT) {
            console.log(`Agent ${agent.agentId} inactive for ${inactiveTime}ms, freezing`);
            await this.freezeAgent(agent);
          }
        }
      } catch (error) {
        console.error('Error in activity monitor:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async startHealthCheck(): Promise<void> {
    setInterval(async () => {
      try {
        const agents = await this.getAllAgentStates();
        
        for (const agent of agents) {
          if (agent.status !== 'active') continue;

          // Check container health
          const container = this.docker.getContainer(agent.containerId!);
          const stats = await container.stats({ stream: false });
          
          // Update resource usage metrics
          agent.memoryUsage = stats.memory_stats.usage;
          agent.cpuUsage = stats.cpu_stats.cpu_usage.total_usage;
          
          // Send health check to agent
          await this.messageQueue.publishToAgent(agent.agentId, {
            type: 'event',
            payload: {
              event: 'HEALTH_CHECK',
              userId: agent.userId
            }
          });

          await this.saveAgentState(agent);
        }
      } catch (error) {
        console.error('Error in health check:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async waitForAgentReady(agentId: string): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      try {
        // Try to get health check response from agent
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Health check timeout')), 5000);

          this.messageQueue.publishToAgent(agentId, {
            type: 'event',
            payload: {
              event: 'HEALTH_CHECK',
              userId: 'system'
            }
          });

          // Make the callback async
          this.messageQueue.subscribeToAgent(agentId, async (msg) => {
            if (msg.type === 'response' && msg.payload.status === 'healthy') {
              clearTimeout(timeout);
              resolve(msg);
            }
            // Need to return a Promise
            return Promise.resolve();
          });
        });

        if (response) return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Agent ${agentId} failed to start within timeout`);
  }

  private async waitForAgentResponse(agentId: string, command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command ${command} timed out`));
      }, this.STARTUP_TIMEOUT);

      // Make the callback async
      this.messageQueue.subscribeToAgent(agentId, async (msg) => {
        if (msg.type === 'response' && msg.payload.command === command) {
          clearTimeout(timeout);
          resolve(msg.payload);
        }
        // Need to return a Promise
        return Promise.resolve();
      });
    });
  }

  private getEnvironmentVariables(): string[] {
    // Get environment variables from process.env
    const requiredVars = [
      'NODE_ENV',
      'LOG_LEVEL',
      'X_AI_API_KEY',
      'CDP_API_KEY',
      'CDP_NETWORK_ID'
    ];

    return requiredVars
      .filter(key => process.env[key])
      .map(key => `${key}=${process.env[key]}`);
  }

  private async getAllAgentStates(): Promise<AgentState[]> {
    try {
        // Get all agent IDs from Redis
        const keys = await this.redis.keys('agent:*:state');
        
        // Get all agent states in parallel
        const states = await Promise.all(
            keys.map(async (key: any) => {
                const data = await this.redis.get(key);
                return data ? JSON.parse(data) as AgentState : null;
            })
        );

        // Filter out null values and validate states
        return states.filter((state): state is AgentState => {
            if (!state) return false;
            
            // Validate required fields
            return (
                typeof state.userId === 'string' &&
                typeof state.agentId === 'string' &&
                typeof state.status === 'string' &&
                state.lastActivity instanceof Date
            );
        });
    } catch (error) {
        console.error('Error getting all agent states:', error);
        return [];
    }
   }

  private async getAgentState(userId: string): Promise<AgentState | null> {
    try {
      // Get agent ID for user
      const agentId = await this.redis.get(`user:${userId}:agentId`);
      if (!agentId) return null;
      
      // Get agent state
      const stateData = await this.redis.get(`agent:${agentId}:state`);
      if (!stateData) return null;

      const state = JSON.parse(stateData);

      // Convert date strings back to Date objects
      state.lastActivity = new Date(state.lastActivity);
      state.createdAt = new Date(state.createdAt);
      if (state.lastFrozen) state.lastFrozen = new Date(state.lastFrozen);
      if (state.lastUnfrozen) state.lastUnfrozen = new Date(state.lastUnfrozen);

      return state;
    } catch (error) {
      console.error(`Error getting agent state for user ${userId}:`, error);
      return null;
    }
  }

  private async saveAgentState(state: AgentState): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Save agent ID mapping for user
      pipeline.set(`user:${state.userId}:agentId`, state.agentId);

      // Save agent state
      pipeline.set(`agent:${state.agentId}:state`, JSON.stringify(state));

      // Execute pipeline
      await pipeline.exec();
    } catch (error) {
      console.error(`Error saving agent state for ${state.agentId}:`, error);
      throw error;
    }
  }

  private async updateAgentActivity(agentId: string): Promise<void> {
    try {
      const state = await this.getAgentStateById(agentId);
      if (state) {
        state.lastActivity = new Date();
        await this.saveAgentState(state);
      }
    } catch (error) {
      console.error(`Error updating activity for agent ${agentId}:`, error);
      throw error;
    }
  }

  private async getAgentStateById(agentId: string): Promise<AgentState | null> {
    try {
      const stateData = await this.redis.get(`agent:${agentId}:state`);
      if (!stateData) return null;

      const state = JSON.parse(stateData);

      // Convert date strings back to Date objects
      state.lastActivity = new Date(state.lastActivity);
      state.createdAt = new Date(state.createdAt);
      if (state.lastFrozen) state.lastFrozen = new Date(state.lastFrozen);
      if (state.lastUnfrozen) state.lastUnfrozen = new Date(state.lastUnfrozen);

      return state;
    } catch (error) {
      console.error(`Error getting agent state for ${agentId}:`, error);
      return null;
    }
  }
}