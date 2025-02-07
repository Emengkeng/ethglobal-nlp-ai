import express, { Application } from 'express';
import chatRoutes from './routes/chat.routes';
import { EnvironmentConfig } from './config/environment';
import { ChatAPIController } from './controllers/chatAPI.controller';

export class App {
  private app: Application;
  private chatController: ChatAPIController;

  constructor() {
    this.app = express();
    this.chatController = new ChatAPIController();
    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private async initialize(): Promise<void> {
    EnvironmentConfig.initialize();
    await this.chatController.initialize();
  }

  private initializeMiddlewares(): void {
    this.app.use(express.json());
  }

  private initializeRoutes(): void {
    this.app.use('/api', chatRoutes);
  }

  public async start(): Promise<void> {
    await this.initialize();
    const PORT = process.env.PORT || 3000;
    this.app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

  public getApp(): Application {
    return this.app;
  }
}