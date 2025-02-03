export interface AgentConfig {
    configurable: {
      thread_id: string;
    }
}
  
export interface WalletConfig {
    cdpWalletData?: string;
    networkId: string;
}

export const MAX_AGENTS_PER_USER = 1;
export const MAX_SYSTEM_AGENTS = 10;