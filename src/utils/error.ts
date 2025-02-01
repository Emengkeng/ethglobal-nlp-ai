export class CdpAgentError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly originalError?: Error
    ) {
      super(message);
      this.name = 'CdpAgentError';
    }
}
  
export const ErrorCodes = {
    INITIALIZATION_FAILED: 'INIT_001',
    WALLET_ERROR: 'WALLET_001',
    NETWORK_ERROR: 'NET_001',
    VALIDATION_ERROR: 'VAL_001'
} as const;