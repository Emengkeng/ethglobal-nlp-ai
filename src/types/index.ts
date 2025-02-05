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


export const MAX_AGENTS_PER_USER = 1;
export const MAX_SYSTEM_AGENTS = 10;