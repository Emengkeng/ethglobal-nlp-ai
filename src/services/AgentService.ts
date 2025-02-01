import { CdpAgentkit } from '@coinbase/cdp-agentkit-core';
import { CdpToolkit } from '@coinbase/cdp-langchain';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { WalletConfig, AgentConfig } from '../types';
import { EnvironmentConfig } from '../config/environment';
import { WalletService } from './WalletService';

export class AgentService {
  static async initialize() {
    try {
      const llm = new ChatOpenAI({
        model: 'grok-beta',
        apiKey: EnvironmentConfig.xAiApiKey,
        configuration: {
          baseURL: 'https://api.x.ai/v1'
        }
      });

      const walletDataStr = await WalletService.loadWalletData();
      
      const config: WalletConfig = {
        cdpWalletData: walletDataStr,
        networkId: EnvironmentConfig.networkId,
      };

      const agentkit = await CdpAgentkit.configureWithWallet(config);
      const cdpToolkit = new CdpToolkit(agentkit);
      const tools = cdpToolkit.getTools();

      const memory = new MemorySaver();
      const agentConfig: AgentConfig = {
        configurable: { thread_id: 'CDP Agentkit Chatbot Example!' }
      };

      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: this.getAgentPrompt()
      });

      await WalletService.saveWalletData(await agentkit.exportWallet());

      return { agent, config: agentConfig };
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  private static getAgentPrompt(): string {
    return `You are a helpful agent that can interact onchain using the Coinbase Developer Platform Agentkit. 
           You are empowered to interact onchain using your tools. If you ever need funds, you can request 
           them from the faucet if you are on network ID \`base-sepolia\`. If not, you can provide your 
           wallet details and request funds from the user. If someone asks you to do something you can't do 
           with your currently available tools, you must say so, and encourage them to implement it themselves 
           using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more informaton. 
           Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless 
           it is explicitly requested.`;
  }
}