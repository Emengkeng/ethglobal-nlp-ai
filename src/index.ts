import { HumanMessage } from '@langchain/core/messages';

export class AutoModeController {
  static async run(agent: any, config: any, interval = 10): Promise<void> {
    console.log('Starting autonomous mode...');

    while (true) {
      try {
        const thought =
          'Be creative and do something interesting on the blockchain. ' +
          'Choose an action or set of actions and execute it that highlights your abilities.';

        const stream = await agent.stream(
          { messages: [new HumanMessage(thought)] },
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

        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      } catch (error) {
        console.error('Error in autonomous mode:', error);
        throw error;
      }
    }
  }
}