export class AgentLimitError extends Error {
    constructor(message: string, public readonly limitType: 'user' | 'system') {
      super(message);
      this.name = 'AgentLimitError';
    }
  }
  
  export class AgentTerminationError extends Error {
    constructor(message: string, public readonly agentId: string) {
      super(message);
      this.name = 'AgentTerminationError';
    }
  }
  
  export function getErrorMessage(error: unknown): string {
      if (error instanceof Error) {
        return error.message;
      } else if (typeof error === 'string') {
        return error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
      }
      return 'An unknown error occurred';
}