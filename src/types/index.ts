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

export type HealthCheckResponse = {
  type: 'response';
  payload: {
    status: string;
  };
};

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

export const MAX_AGENTS_PER_USER = 1;
export const MAX_SYSTEM_AGENTS = 20;