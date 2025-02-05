export interface AgentConfig {
    configurable: {
      thread_id: string;
    }
}
  
export interface WalletConfig {
    cdpWalletData?: string;
    networkId: string;
}

export interface QueueMessage {
  type: 'command' | 'response' | 'event';
  payload: any;
  metadata: {
    userId: string;
    agentId: string;
    timestamp: number;
    messageId: string;
    priority: 'low' | 'medium' | 'high';
    attempts: number;
  };
}

export interface SubscriptionOptions {
  consumerTag?: string;
  filter?: (msg: QueueMessage) => boolean;
}


export interface HealthCheckResponse extends QueueMessage {
  type: 'response';
  payload: {
    status: 'healthy' | 'unhealthy';
    details?: string;
  };
}

export class AgentStartupError extends Error {
  constructor(message: string, public readonly agentId: string) {
    super(message);
    this.name = 'AgentStartupError';
  }
}

export class HealthCheckTimeoutError extends Error {
  constructor(message: string, public readonly agentId: string) {
    super(message);
    this.name = 'HealthCheckTimeoutError';
  }
}

class AgentHealthCheckError extends Error {
  constructor(
    message: string, 
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AgentHealthCheckError';
  }
}

export class AgentTimeoutError extends AgentHealthCheckError {
  constructor(agentId: string, timeoutMs: number) {
    super(`Agent ${agentId} health check timed out after ${timeoutMs}ms`, agentId);
    this.name = 'AgentTimeoutError';
  }
}

export const MAX_AGENTS_PER_USER = 1;
export const MAX_SYSTEM_AGENTS = 20;