import { Request, Response } from 'express';
import { AgentService } from '../services/AgentService';
import { HumanMessage } from '@langchain/core/messages';

export class ChatAPIController {
  private agent: any;
  private config: any;

  constructor() {
    this.initializeAgent();
  }

  private async initializeAgent() {
    const { agent, config } = await AgentService.initialize();
    this.agent = agent;
    this.config = config;
  }

  chat = async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const stream = await this.agent.stream(
        { messages: [new HumanMessage(message)] },
        this.config
      );

      const responses = [];
      for await (const chunk of stream) {
        if ('agent' in chunk) {
          responses.push({
            type: 'agent',
            content: chunk.agent.messages[0].content
          });
        } else if ('tools' in chunk) {
          responses.push({
            type: 'tools',
            content: chunk.tools.messages[0].content
          });
        }
      }

      res.json({ responses });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  };

  getStatus = async (_req: Request, res: Response) => {
    try {
      res.json({ status: 'active' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get status' });
    }
  };
}