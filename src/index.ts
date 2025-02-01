import { EnvironmentConfig } from './config/environment';
import { AgentService } from './services/AgentService';
import { ChatController } from './controllers/ChatController';
import { AutoModeController } from './controllers/AutoModeController';

async function main() {
  try {
    EnvironmentConfig.initialize();
    
    const { agent, config } = await AgentService.initialize();
    const chatController = new ChatController();
    const mode = await chatController.chooseMode();

    if (mode === 'chat') {
      await chatController.runChatMode(agent, config);
    } else {
      await AutoModeController.run(agent, config);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('Starting Agent...');
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}