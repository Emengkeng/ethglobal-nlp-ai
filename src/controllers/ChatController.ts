import { HumanMessage } from '@langchain/core/messages';
import * as readline from 'readline';
import { promisify } from 'util';

export class ChatController {
  private readonly rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async question(prompt: string): Promise<string> {
    return new Promise(resolve => this.rl.question(prompt, resolve));
  }

  async runChatMode(agent: any, config: any): Promise<void> {
    console.log('Starting chat mode... Type \'exit\' to end.');

    try {
      while (true) {
        const userInput = await this.question('\nPrompt: ');

        if (userInput.toLowerCase() === 'exit') {
          break;
        }

        const stream = await agent.stream(
          { messages: [new HumanMessage(userInput)] },
          config
        );

        for await (const chunk of stream) {
          if ('agent' in chunk) {
            console.log(chunk.agent.messages[0].content);
          } else if ('tools' in chunk) {
            console.log(chunk.tools.messages[0].content);
          }
          console.log('-------------------');
        }
      }
    } finally {
      this.rl.close();
    }
  }

  async chooseMode(): Promise<'chat' | 'auto'> {
    while (true) {
      console.log('\nAvailable modes:');
      console.log('1. chat    - Interactive chat mode');
      console.log('2. auto    - Autonomous action mode');

      const choice = (await this.question('\nChoose a mode (enter number or name): '))
        .toLowerCase()
        .trim();

      if (choice === '1' || choice === 'chat') {
        return 'chat';
      } else if (choice === '2' || choice === 'auto') {
        return 'auto';
      }
      console.log('Invalid choice. Please try again.');
    }
  }
}