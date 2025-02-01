export interface AgentConfig {
    configurable: {
      thread_id: string;
    }
  }
  
  export interface WalletConfig {
    cdpWalletData?: string;
    networkId: string;
}