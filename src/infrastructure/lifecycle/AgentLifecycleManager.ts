import Docker from 'dockerode';
import { MessageQueue } from '../queue/MessageQueue';
import Redis, { Redis as RedisClient } from 'ioredis';
import { DockerDeployment } from '@/deployment/DockerDeployment';
import { AgentState } from './AgentState';
import { AgentLimitError, AgentTerminationError, getErrorMessage } from './AgentErrors';
import { MAX_AGENTS_PER_USER, MAX_SYSTEM_AGENTS } from '@/types'; 
import { messageQueueSingleton } from '../queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';


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
    this.redis = new Redis(process.env.REDIS_URL || "");
    this.messageQueue = messageQueueSingleton;

    this.dockerDeployment = new DockerDeployment();
    
    // Start monitoring systems
    this.startActivityMonitor();
    this.startHealthCheck();
  }

  async handleUserActivity(userId: string): Promise<string> {
    logger.info(`Handling user activity`, { 
      userId, 
      action: 'handleUserActivity' 
    });
  
    // Get or create agent for user
    const agentState = await this.getAgentState(userId);
    
    if (!agentState) {
      // New user signup - create agent
      logger.info(`No existing agent found for user`, { 
        userId, 
        action: 'createNewAgent' 
      });
      return this.createAgent(userId);
    }
  
    logger.info(`Existing agent state found`, { 
      userId, 
      agentId: agentState.agentId, 
      status: agentState.status 
    });
  
    if (agentState.status === 'frozen') {
      // User returning - unfreeze agent
      logger.info(`Unfreezing frozen agent`, { 
        userId, 
        agentId: agentState.agentId, 
        action: 'unfreezeAgent' 
      });
      return this.unfreezeAgent(agentState);
    }
  
    if (agentState.status === 'error') {
      // Agent in error state - attempt recovery
      logger.warn(`Agent in error state, attempting recovery`, { 
        userId, 
        agentId: agentState.agentId, 
        action: 'recoverAgent' 
      });
      return this.recoverAgent(agentState);
    }
  
    // Update last activity timestamp
    await this.updateAgentActivity(agentState.agentId);
    
    logger.info(`User activity handled successfully`, { 
      userId, 
      agentId: agentState.agentId, 
      action: 'updateActivity' 
    });
  
    return agentState.agentId;
  }

  public async createAgent(userId: string): Promise<string> {
    logger.info(`Attempting to create new agent for user ${userId}`);

    // Check both user and system limits
    await this.checkAgentLimits(userId);

    const agentId = `trading-agent-${userId}-${Date.now()}`;
    
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

      logger.info(`Agent ${agentId} created successfully`);
      return agentId;
    } catch (error) {
      logger.error(`Error creating agent for user ${userId}:`, error);

      if (error instanceof AgentLimitError) {
        if (error.limitType === 'user') {
            // Handle user limit reached
            logger.log('User limit reached:', error.message);
        } else {
            // Handle system limit reached
            logger.log('System limit reached:', error.message);
        }
      }
      throw error;
    }
  }

  private async freezeAgent(agentState: AgentState): Promise<void> {
    logger.info(`Freezing agent ${agentState.agentId}`);
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

      logger.info(`Agent ${agentState.agentId} frozen successfully`);
    } catch (error: unknown) {
      logger.error(`Error freezing agent ${agentState.agentId}:`, error);
      // Mark agent as error state
      agentState.status = 'error';
      agentState.errorMessage = getErrorMessage(error);
      await this.saveAgentState(agentState);
    }
  }

  private async unfreezeAgent(agentState: AgentState): Promise<string> {
    logger.info(`Unfreezing agent ${agentState.agentId}`);
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

      logger.info(`Agent ${agentState.agentId} unfrozen successfully`);
      return agentState.agentId;
    } catch (error: unknown) {
      logger.error(`Error unfreezing agent ${agentState.agentId}:`, error);
      // Mark agent as error state
      agentState.status = 'error';
      agentState.errorMessage = getErrorMessage(error);
      await this.saveAgentState(agentState);
      throw error;
    }
  }

  private async recoverAgent(agentState: AgentState): Promise<string> {
    logger.info(`Attempting to recover agent ${agentState.agentId}`);
    try {
      // Remove old container
      const oldContainer = this.docker.getContainer(agentState.containerId!);
      await oldContainer.remove({ force: true });

      // Create new container
      return await this.createAgent(agentState.userId);
    } catch (error) {
      logger.error(`Error recovering agent ${agentState.agentId}:`, error);
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
            logger.info(`Agent ${agent.agentId} inactive for ${inactiveTime}ms, freezing`);
            await this.freezeAgent(agent);
          }
        }
      } catch (error) {
        logger.error('Error in activity monitor:', error);
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
        logger.error('Error in health check:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async waitForAgentReady(agentId: string): Promise<void> {
    const startTime = Date.now();
    logger.info(`Waiting for agent ${agentId} to be ready`, { timeout: this.STARTUP_TIMEOUT });
    
    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      try {
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            logger.warn(`Health check timeout for agent ${agentId}`);
            reject(new Error('Health check timeout'));
          }, 50000);
  
          this.messageQueue.publishToAgent(agentId, {
            type: 'event',
            payload: {
              event: 'HEALTH_CHECK',
              userId: 'system'
            }
          });
  
          this.messageQueue.subscribeToAgent(agentId, async (msg) => {
            if (msg.type === 'response' && msg.payload.status === 'healthy') {
              clearTimeout(timeout);
              logger.info(`Agent ${agentId} is ready`);
              resolve(msg);
            }
            return Promise.resolve();
          });
        });
  
        if (response) return;
      } catch (error) {
        logger.info(`Retrying agent readiness check for ${agentId}`, { error });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  
    logger.error(`Agent ${agentId} failed to start within timeout`);
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
        const keys = await this.redis.keys('agent:*:state');
        
        const states = await Promise.all(
            keys.map(async (key: any) => {
                const data = await this.redis.get(key);
                if (!data) return null;
                
                const state = JSON.parse(data);
                // Convert date strings back to Date objects
                state.lastActivity = new Date(state.lastActivity);
                state.createdAt = new Date(state.createdAt);
                return state;
            })
        );

        return states.filter((state: { userId: any; agentId: any; status: any; lastActivity: any; createdAt: any; }): state is AgentState => {
            if (!state) return false;
            
            return (
                typeof state.userId === 'string' &&
                typeof state.agentId === 'string' &&
                typeof state.status === 'string' &&
                state.lastActivity instanceof Date &&
                state.createdAt instanceof Date
            );
        });
    } catch (error) {
        logger.error('Error getting all agent states:', error);
        throw error;
    }
  }

  private async getActiveAgentCounts(userId: string): Promise<{ userCount: number; systemCount: number }> {
    const states = await this.getAllAgentStates();
    const activeStates = states.filter(state => ['starting', 'active'].includes(state.status));
    
    return {
        userCount: activeStates.filter(state => state.userId === userId).length,
        systemCount: activeStates.length
    };
  }

  private async checkAgentLimits(userId: string): Promise<void> {
    const { userCount, systemCount } = await this.getActiveAgentCounts(userId);
  
    logger.info(`Agent limit check for user ${userId}`, { 
      userCount, 
      systemCount, 
      maxUserAgents: MAX_AGENTS_PER_USER, 
      maxSystemAgents: MAX_SYSTEM_AGENTS 
    });
  
    if (userCount >= MAX_AGENTS_PER_USER) {
      logger.warn(`User ${userId} has reached agent limit`, { 
        currentCount: userCount, 
        maxAllowed: MAX_AGENTS_PER_USER 
      });
      throw new AgentLimitError(
        `Cannot create new agent. User ${userId} has reached the maximum limit of ${MAX_AGENTS_PER_USER} agents.`,
        'user'
      );
    }
  
    if (systemCount >= MAX_SYSTEM_AGENTS) {
      logger.warn('System agent limit reached', { 
        currentCount: systemCount, 
        maxAllowed: MAX_SYSTEM_AGENTS 
      });
      throw new AgentLimitError(
        `Cannot create new agent. System has reached the maximum limit of ${MAX_SYSTEM_AGENTS} agents.`,
        'system'
      );
    }
  }

  private async getAgentState(userId: string): Promise<AgentState | null> {
    try {
      logger.info(`Retrieving agent state for user`, { 
        userId,
        action: 'getAgentState' 
      });
  
      // Get agent ID for user
      const agentId = await this.redis.get(`user:${userId}:agentId`);
      if (!agentId) {
        logger.info(`No agent ID found for user`, { 
          userId,
          action: 'noAgentIdFound' 
        });
        return null;
      }
      
      // Get agent state
      const stateData = await this.redis.get(`agent:${agentId}:state`);
      if (!stateData) {
        logger.warn(`No state data found for agent`, { 
          userId,
          agentId,
          action: 'noStateDataFound' 
        });
        return null;
      }
  
      const state = JSON.parse(stateData);
  
      // Convert date strings back to Date objects
      state.lastActivity = new Date(state.lastActivity);
      state.createdAt = new Date(state.createdAt);
      if (state.lastFrozen) state.lastFrozen = new Date(state.lastFrozen);
      if (state.lastUnfrozen) state.lastUnfrozen = new Date(state.lastUnfrozen);
  
      logger.info(`Agent state retrieved successfully`, { 
        userId,
        agentId,
        status: state.status,
        lastActivity: state.lastActivity,
        action: 'agentStateRetrieved' 
      });
  
      return state;
    } catch (error) {
      logger.error(`Error getting agent state for user`, { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'getAgentStateError' 
      });
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
      logger.error(`Error saving agent state for ${state.agentId}:`, error);
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
      logger.error(`Error updating activity for agent ${agentId}:`, error);
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
      logger.error(`Error getting agent state for ${agentId}:`, error);
      return null;
    }
  }

  // Kill All agent 
  private async killAgent(agentId: string): Promise<void> {
    try {
      logger.info(`Attempting to kill agent ${agentId}`);
      const state = await this.getAgentState(agentId);
      
      if (!state) {
        logger.warn(`No state found for agent ${agentId}`);
        throw new Error(`No state found for agent ${agentId}`);
      }
  
      if (!state.containerId) {
        logger.warn(`No container ID found for agent ${agentId}`);
        throw new Error(`No container ID found for agent ${agentId}`);
      }
  
      const oldContainer = this.docker.getContainer(state.containerId);
      await oldContainer.remove({ force: true });
      
      state.status = 'stopping';
      state.lastActivity = new Date();
      await this.saveAgentState(state);
      
      await this.redis.del(`user:${state.userId}:agentId`);
      await this.redis.del(`agent:${agentId}:state`);
      
      logger.info(`Successfully terminated and removed container for agent ${agentId}`, {
        userId: state.userId,
        containerId: state.containerId
      });
    } catch (error) {
      logger.error(`Error terminating agent ${agentId}`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw new AgentTerminationError(`Failed to terminate agent ${agentId}: ${error}`, agentId);
    }
  }
  
  public async killAllAgents(): Promise<{ 
    success: boolean; 
    terminated: string[]; 
    failed: { agentId: string; error: string }[] 
  }> {
    logger.info('Initiating termination of all agents...');
    
    const result = {
      success: true,
      terminated: [] as string[],
      failed: [] as { agentId: string; error: any }[]
    };
  
    try {
      //let DeclaredAgentId
      // Get all active agents
      const states = await this.getAllAgentStates();
      const activeAgents = states.filter(state => 
        ['starting', 'active'].includes(state.status) && state.containerId
      );
  
      if (activeAgents.length === 0) {
        logger.info('No active agents found to terminate');
        // Clean up any additional resources
        await this.messageQueue.cleanup();
        return result;
      }
  
      // Kill agents in parallel with timeout
      const killPromises = activeAgents.map(async (state) => {
        try {
          await Promise.race([
            //DeclaredAgentId = state.agentId,
            this.killAgent(state.userId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 30000) // 30 second timeout
            )
          ]);
          result.terminated.push(state.agentId);
        } catch (error) {
          result.failed.push({
            agentId: state.agentId,
            error: error || 'Unknown error'
          });
        }
      });
  
      await Promise.all(killPromises);
  
      // Update final success status
      result.success = result.failed.length === 0;
  
      // Log summary
      logger.log('Agent termination summary:', {
        totalAttempted: activeAgents.length,
        successful: result.terminated.length,
        failed: result.failed.length
      });
  
      return result;
    } catch (error) {
      logger.error('Critical error in killAllAgents:', error);
      //throw new AgentTerminationError(`Critical error in killAllAgents: ${error}`, DeclaredAgentId);
      throw error;
    }
  }
  
  // Optional: Add method to get termination status
  public async getTerminationStatus(): Promise<{
    activeAgents: number;
    terminatedAgents: number;
    failedAgents: number;
  }> {
    const states = await this.getAllAgentStates();
    
    return {
      activeAgents: states.filter(s => ['starting', 'active'].includes(s.status)).length,
      terminatedAgents: states.filter(s => s.status === 'stopping').length,
      failedAgents: states.filter(s => s.status === 'error').length
    };
  }
}