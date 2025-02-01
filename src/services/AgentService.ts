import { OpenAI } from 'openai';
import { CdpAgentkit } from '@coinbase/cdp-agentkit-core';
import { CdpToolkit } from '@coinbase/cdp-langchain';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { WalletConfig, AgentConfig } from '../types';
import { EnvironmentConfig } from '../config/environment';
import { WalletService } from './WalletService';
import { SystemMessage } from '@langchain/core/messages';
import { MessagesAnnotation } from '@langchain/langgraph';

export class AgentService {
  static async initialize() {
    try {
      // Initialize OpenAI client with X.AI configuration
      const openAIConfig = {
        apiKey: EnvironmentConfig.xAiApiKey,
        baseURL: 'https://api.x.ai/v1'
      };

      // Use LangChain's ChatOpenAI wrapper
      const llm = new ChatOpenAI({
        modelName: 'grok-2-1212',
        openAIApiKey: openAIConfig.apiKey,
        configuration: {
          baseURL: openAIConfig.baseURL,
          defaultHeaders: {
            'Content-Type': 'application/json'
          }
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

      // Create state modifier function that works with the full graph state
      const stateModifier = async (state: typeof MessagesAnnotation.State) => {
        const systemMessage = new SystemMessage(this.getAgentPrompt());
        return [systemMessage, ...state.messages];
      };

      // Create the agent with the state modifier
      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        stateModifier
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