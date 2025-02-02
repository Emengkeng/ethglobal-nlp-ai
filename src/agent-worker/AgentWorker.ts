import { AgentService } from '@/services/AgentService';
import { WalletService } from '@/services/WalletService';
import { EnvironmentConfig } from '../config/environment';
import { MessageQueue } from '../infrastructure/queue/MessageQueue';

export class AgentWorker {
  private messageQueue: MessageQueue;
  private agent: any;  // Your existing CDP trading agent
  private config: any;
  private walletService: WalletService;

  constructor(
    private readonly agentId: string,
    private readonly userId: string,
    private readonly persistenceLayer: AgentPersistenceLayer
  ) {
    this.messageQueue = new MessageQueue();
    this.walletService = new WalletService();
  }

  async initialize() {
    // 1. Load existing wallet data for this user
    const walletData = await this.persistenceLayer.loadWalletData(this.userId);
    
    // 2. Initialize your existing trading agent with user's wallet
    const { agent, config } = await AgentService.initialize({
      cdpWalletData: walletData,
      networkId: EnvironmentConfig.networkId,
      configurable: {
        thread_id: `${this.userId}-${this.agentId}`,
        // Your existing config here
      }
    });

    this.agent = agent;
    this.config = config;

    // 3. Set up message handling for this agent instance
    await this.subscribeToMessages();
  }

  private async subscribeToMessages() {
    await this.messageQueue.subscribeToAgent(this.agentId, async (message) => {
      try {
        // Use your existing agent's stream processing
        const stream = await this.agent.stream(
          { messages: [new HumanMessage(message.payload.content)] },
          this.config
        );

        // Process responses from your trading agent
        for await (const chunk of stream) {
          if ('agent' in chunk) {
            await this.handleAgentResponse(chunk.agent);
          } else if ('tools' in chunk) {
            await this.handleToolExecution(chunk.tools);
          }
        }

        // Save updated wallet state after processing
        const updatedWalletData = await this.agent.exportWallet();
        await this.persistenceLayer.saveWalletData(this.userId, updatedWalletData);

      } catch (error) {
        console.error('Error processing message:', error);
        throw error;
      }
    });
  }
}