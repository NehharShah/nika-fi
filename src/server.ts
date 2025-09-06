import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import referralRoutes from './routes/referral';

// Import configuration
import { config, apiConfig } from './config';
import { errorMessages } from './config';

// Load environment variables by environment
// Priority: .env.<NODE_ENV> -> .env
try {
  const env = process.env.NODE_ENV || 'development';
  dotenv.config({ path: `.env.${env}` });
} catch (e) {
  // fallback to default .env
  dotenv.config();
}

/**
 * Nika Referral System Server
 * 
 * Express.js server implementing a commission-based referral system
 * with sophisticated business logic for fee calculation and multi-level
 * commission distribution.
 */

class Server {
  private app: Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup global middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: apiConfig.cors.origin,
      credentials: apiConfig.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Logging middleware
    if (config.nodeEnv !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request timeout middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setTimeout(30000, () => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            error: 'REQUEST_TIMEOUT',
            message: 'Request timeout',
          });
        }
      });
      next();
    });

    // Request ID middleware for tracking
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] || 
                       `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.headers['x-request-id'] = requestId as string;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
      });
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Nika Referral System API',
        version: 'v1',
        endpoints: {
          referral: {
            'POST /api/referral/register': 'Register user with referral code',
            'POST /api/referral/generate': 'Generate referral code for user',
            'GET /api/referral/network/:userId': 'Get user referral network',
            'GET /api/referral/earnings/:userId': 'Get user earnings breakdown',
            'POST /api/referral/claim': 'Validate claim request',
            'GET /api/referral/validate-code/:code': 'Validate referral code',
            'PUT /api/referral/fee-tier/:userId': 'Update user fee tier',
            'GET /api/referral/statistics': 'Get platform statistics (admin)',
            'POST /api/webhook/trade': 'Process trade webhook',
          },
        },
        authentication: 'Bearer JWT token required for authenticated endpoints',
        webhooks: 'API key required in X-API-Key header',
      });
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    // API routes
    this.app.use(`/api/referral`, referralRoutes);
    this.app.use(`/api/webhook`, referralRoutes); // Webhook routes are included in referral routes

    // Catch-all for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          'GET /health',
          'GET /api/docs',
          'POST /api/referral/register',
          'POST /api/referral/generate',
          'GET /api/referral/network/:userId',
          'GET /api/referral/earnings/:userId',
          'POST /api/referral/claim',
          'GET /api/referral/validate-code/:code',
          'PUT /api/referral/fee-tier/:userId',
          'GET /api/referral/statistics',
          'POST /api/webhook/trade',
        ],
      });
    });
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', {
        error: err.message,
        stack: err.stack,
        requestId: req.headers['x-request-id'],
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Don't leak error details in production
      const isDevelopment = config.nodeEnv === 'development';

      // Handle specific error types
      if (err.type === 'entity.parse.failed') {
        res.status(400).json({
          success: false,
          error: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
          ...(isDevelopment && { details: err.message }),
        });
        return;
      }

      if (err.type === 'entity.too.large') {
        res.status(413).json({
          success: false,
          error: 'REQUEST_TOO_LARGE',
          message: 'Request entity too large',
        });
        return;
      }

      // Database connection errors
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database connection failed',
        });
        return;
      }

      // Prisma errors
      if (err.code?.startsWith('P')) {
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Database operation failed',
          ...(isDevelopment && { details: err.message }),
        });
        return;
      }

      // JWT errors
      if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          error: 'TOKEN_INVALID',
          message: 'Invalid authentication token',
        });
        return;
      }

      if (err.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        });
        return;
      }

      // Default error response
      res.status(err.status || 500).json({
        success: false,
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || errorMessages.INTERNAL_SERVER_ERROR,
        ...(isDevelopment && { stack: err.stack }),
        requestId: req.headers['x-request-id'],
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      
      // Graceful shutdown
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      
      // Graceful shutdown
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle SIGTERM (Docker/Kubernetes shutdown)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown('SIGINT');
    });
  }

  /**
   * Graceful shutdown
   */
  private gracefulShutdown(signal: string): void {
    console.log(`Graceful shutdown initiated by ${signal}`);
    
    // Close server
    if (this.server) {
      this.server.close(() => {
        console.log('HTTP server closed');
        
        // Exit process
        process.exit(signal === 'UNCAUGHT_EXCEPTION' || signal === 'UNHANDLED_REJECTION' ? 1 : 0);
      });

      // Force close after timeout
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  }

  private server: any;

  /**
   * Start the server
   */
  public start(): void {
    const port = config.port;
    
    this.server = this.app.listen(port, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║           🚀 NIKA REFERRAL SYSTEM           ║
╠══════════════════════════════════════════════╣
║ Server running on: http://localhost:${port}     ║
║ Environment: ${config.nodeEnv.padEnd(31)} ║
║ API Documentation: /api/docs                 ║
║ Health Check: /health                        ║
╚══════════════════════════════════════════════╝
      `);

      if (config.nodeEnv === 'development') {
        console.log(`
📚 Quick Start:
• Register user: POST /api/referral/register
• Generate referral: POST /api/referral/generate  
• Process trade: POST /api/webhook/trade
• View network: GET /api/referral/network/:userId
• Check earnings: GET /api/referral/earnings/:userId

🔧 Configuration:
• Max referral depth: 3 levels
• Commission rates: L1=30%, L2=3%, L3=2%
• Default fee discount: 10%
• Base fee rate: 1%
        `);
      }
    });

    this.server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          console.error(`Port ${port} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`Port ${port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  public getApp(): Application {
    return this.app;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}

export default Server;
