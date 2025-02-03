import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';

// Import route modules
import agentRoutes from '@/api/routes/AgentRoutes';
import { AgentLifecycleManager } from './infrastructure/lifecycle/AgentLifecycleManager';

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
      console.error('Unhandled error:', err);

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : err.message
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      
      // Attempt graceful shutdown
      this.shutdownGracefully();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Attempt graceful shutdown
      this.shutdownGracefully();
    });
  }

  private shutdownGracefully(): void {
    console.log('Attempting graceful shutdown...');

    // Terminate all agents
    this.lifecycleManager.killAllAgents()
      .then(() => {
        console.log('All agents terminated successfully');
        process.exit(1);
      })
      .catch((error) => {
        console.error('Error during agent termination:', error);
        process.exit(1);
      });
  }

  public start(): void {
    // Create HTTP server
    this.server = http.createServer(this.app);

    // Start server
    this.server.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private shutdown(): void {
    console.log('Received termination signal. Shutting down gracefully...');

    this.server.close((err) => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }

      // Terminate all agents before exiting
      this.lifecycleManager.killAllAgents()
        .then(() => {
          console.log('Server and agents shut down successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('Error during shutdown:', error);
          process.exit(1);
        });
    });
  }
}

// Initialize and start the server
const server = new Server();
server.start();

export default server;