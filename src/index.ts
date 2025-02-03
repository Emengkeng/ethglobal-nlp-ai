import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';

import agentRoutes from '@/api/routes/AgentRoutes';
import { AgentLifecycleManager } from './infrastructure/lifecycle/AgentLifecycleManager';
import { initializeMessageQueue } from './infrastructure/queue/messageQueueSingleton';
import { logger } from '@/utils/LoggerService';


class Server {
  private app: Application;
  private server!: http.Server;
  private port: number;
  private lifecycleManager: AgentLifecycleManager;

  constructor() {
    // Load environment variables
    dotenv.config();

    // Initialize express app
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);

    // Initialize lifecycle manager
    this.lifecycleManager = new AgentLifecycleManager();

    // Configure middleware
    this.configureMiddleware();

    // Set up routes
    this.setupRoutes();

    // Configure error handling
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Parse JSON bodies
    this.app.use(express.json({
      limit: '1mb' // Prevent large payload attacks
    }));

    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ 
      extended: true,
      limit: '1mb'
    }));
  }

  private setupRoutes(): void {
    // Health check route
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // Mount agent routes
    this.app.use('/api/agents', agentRoutes);

    // Catch-all route for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl
      });
    });
  }

  private configureErrorHandling(): void {
    // Centralized error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', err);

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : err.message
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      
      // Attempt graceful shutdown
      this.shutdownGracefully();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Attempt graceful shutdown
      this.shutdownGracefully();
    });
  }

  private shutdownGracefully(): void {
    logger.info('Attempting graceful shutdown...');

    // Terminate all agents
    this.lifecycleManager.killAllAgents()
      .then(() => {
        logger.info('All agents terminated successfully');
        process.exit(1);
      })
      .catch((error) => {
        logger.error('Error during agent termination:', error);
        process.exit(1);
      });
  }

  public async start(): Promise<void> {

    // Initialize message queue
    await initializeMessageQueue();


    // Create HTTP server
    this.server = http.createServer(this.app);

    // Start server
    this.server.listen(this.port, () => {
      logger.info(`Server running on port ${this.port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private shutdown(): void {
    logger.info('Received termination signal. Shutting down gracefully...');

    this.server.close((err) => {
      if (err) {
        logger.error('Error closing server:', err);
        process.exit(1);
      }

      // Terminate all agents before exiting
      this.lifecycleManager.killAllAgents()
        .then(() => {
          logger.info('Server and agents shut down successfully');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        });
    });
  }
}

// Initialize and start the server
const server = new Server();
server.start();

export default server;