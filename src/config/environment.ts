import * as dotenv from 'dotenv';

export class EnvironmentConfig {
  private static readonly REQUIRED_VARS = [
    'XAI_API_KEY',
    'CDP_API_KEY_NAME',
    'CDP_API_KEY_PRIVATE_KEY'
  ];

  static initialize(): void {
    dotenv.config();
    this.validateEnvironment();
  }

  private static validateEnvironment(): void {
    const missingVars = this.REQUIRED_VARS.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error('Error: Required environment variables are not set');
      missingVars.forEach(varName => {
        console.error(`${varName}=your_${varName.toLowerCase()}_here`);
      });
      process.exit(1);
    }

    if (!process.env.NETWORK_ID) {
      console.warn('Warning: NETWORK_ID not set, defaulting to base-sepolia testnet');
    }
  }

  static get networkId(): string {
    return process.env.NETWORK_ID || 'base-sepolia';
  }

  static get xAiApiKey(): string {
    return process.env.XAI_API_KEY!;
  }
}