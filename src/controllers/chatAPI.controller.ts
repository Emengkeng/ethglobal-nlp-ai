import { Request, Response } from 'express';
import { AgentService } from '../services/AgentService';
import { HumanMessage } from '@langchain/core/messages';

export class ChatAPIController {
  private agent: any;
  private config: any;
  private initialized: boolean = false;

  constructor() {
    // Immediately initialize when controller is created
    this.initialize().catch(error => {
      console.error('Failed to initialize controller:', error);
    });
  }

  async initialize(): Promise<void> {
    try {
      const result = await AgentService.initialize();
      this.agent = result.agent;
      this.config = result.config;
      this.initialized = true;
      console.log("Controller initialized successfully");
    } catch (error) {
      console.error(`Initialization failed`, { error });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public chat = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.ensureInitialized();

      const { message } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (!this.agent || !this.config) {
        throw new Error('Controller not properly initialized');
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
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  };

  public getStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.ensureInitialized();
      res.json({ 
        status: 'active',
        initialized: this.initialized
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get status',
        initialized: this.initialized
      });
    }
  };
}