import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, errorMessages } from '../config';
import { DatabaseService } from '../services/database';
import { ErrorUtils } from '../utils/helpers';

/**
 * Authentication Middleware
 * 
 * Handles JWT token validation and user authentication
 */

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: errorMessages.UNAUTHORIZED,
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Add user info to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        iat: decoded.iat,
        exp: decoded.exp,
      };

      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          message: errorMessages.TOKEN_EXPIRED,
        });
        return;
      }

      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          error: 'TOKEN_INVALID',
          message: errorMessages.TOKEN_INVALID,
        });
        return;
      }

      throw jwtError;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Middleware to validate that the authenticated user matches the userId in the request
 */
export const validateUserAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const requestUserId = req.params.userId || req.body.userId || req.query.userId;
    
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: errorMessages.UNAUTHORIZED,
      });
      return;
    }

    if (requestUserId && requestUserId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied: User can only access their own data',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('User access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Middleware for optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          iat: decoded.iat,
          exp: decoded.exp,
        };
      } catch (jwtError) {
        // Don't fail for optional auth, just continue without user
        console.warn('Optional auth failed:', jwtError);
      }
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
};

/**
 * Middleware to check if user is an admin (for admin endpoints)
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: errorMessages.UNAUTHORIZED,
      });
      return;
    }

    // In a real application, you would check the user's role in the database
    // For this demo, we'll check if the user has a specific email domain or role
    const db = new DatabaseService();
    await db.initialize();
    
    const user = await db.findUserById(req.user.id);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: errorMessages.USER_NOT_FOUND,
      });
      return;
    }

    // Check if user is team member (simple admin check for demo)
    if (!user.isTeamMember) {
      res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required',
      });
      return;
    }

    await db.disconnect();
    next();
  } catch (error) {
    console.error('Admin validation error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Middleware to validate API key for webhook endpoints
 */
export const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    // In production, you would validate against stored API keys
    // For demo purposes, we'll use a simple check
    const validApiKey = process.env.WEBHOOK_API_KEY || 'nika-webhook-secret-key';
    
    if (!apiKey || apiKey !== validApiKey) {
      res.status(401).json({
        success: false,
        error: 'INVALID_API_KEY',
        message: 'Invalid or missing API key',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Generate a JWT token for testing purposes
 */
export const generateTestToken = (userId: string, email: string): string => {
  const secret = config.jwt.secret || 'fallback-secret-for-testing';
  return jwt.sign(
    { userId, email },
    secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
};

/**
 * Middleware to extract user ID from various sources
 */
export const extractUserId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Try to get userId from params, body, or query
    let userId = req.params.userId || req.body.userId || req.query.userId;
    
    // If no userId provided and user is authenticated, use their ID
    if (!userId && req.user) {
      userId = req.user.id;
    }

    if (userId) {
      req.body.userId = userId; // Ensure it's in body for consistent access
    }

    next();
  } catch (error) {
    console.error('User ID extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Rate limiting by user ID
 */
const userRateLimits = new Map<string, { count: number; resetTime: number }>();

export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const userId: string = req.user?.id || req.ip || 'anonymous'; // Ensure userId is always a string
      const now = Date.now();
      
      // Clean up expired entries
      for (const [key, data] of userRateLimits.entries()) {
        if (now > data.resetTime) {
          userRateLimits.delete(key);
        }
      }

      // Get or create rate limit data for user
      let userLimit = userRateLimits.get(userId);
      if (!userLimit || now > userLimit.resetTime) {
        userLimit = {
          count: 0,
          resetTime: now + windowMs,
        };
        userRateLimits.set(userId, userLimit);
      }

      // Check if limit exceeded
      if (userLimit.count >= maxRequests) {
        res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: errorMessages.RATE_LIMIT_EXCEEDED,
          retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
        });
        return;
      }

      // Increment counter
      userLimit.count++;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - userLimit.count).toString(),
        'X-RateLimit-Reset': Math.ceil(userLimit.resetTime / 1000).toString(),
      });

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Don't fail the request due to rate limiting errors
    }
  };
};
