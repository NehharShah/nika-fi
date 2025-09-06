import { Request, Response, NextFunction } from 'express';
import { ReferralService } from '../services/referralService';
import { ErrorUtils, ValidationUtils, PaginationUtils } from '../utils/helpers';
import { apiConfig, errorMessages } from '../config';
import Joi from 'joi';

/**
 * Referral Controller - HTTP endpoint handlers for referral system
 * 
 * This controller handles all referral-related HTTP requests including:
 * - Referral code generation and validation
 * - User registration with referrals
 * - Network visualization and analytics
 * - Earnings tracking and reporting
 * - Trade webhook processing
 */
export class ReferralController {
  private referralService: ReferralService;

  constructor() {
    this.referralService = new ReferralService();
  }

  /**
   * Initialize the controller
   */
  async initialize(): Promise<void> {
    await this.referralService.initialize();
  }

  /**
   * POST /api/referral/generate
   * Generate unique referral code for authenticated user
   */
  generateReferralCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      const result = await this.referralService.generateReferralCode(value);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/referral/register  
   * Register a new user with a referral code
   */
  registerWithReferral = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        email: Joi.string().email().max(254).required(),
        username: Joi.string().alphanum().min(3).max(30).optional(),
        password: Joi.string().min(8).max(128).required(),
        referralCode: Joi.string().length(8).pattern(/^NIKA[A-Z0-9]{4}$/).optional(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      const result = await this.referralService.registerWithReferral(value);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/referral/network
   * Return user's referral network (3 levels deep)
   */
  getReferralNetwork = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(apiConfig.defaultPagination.maxLimit).default(20),
      });

      const queryData = {
        userId: req.params.userId || req.query.userId,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const { error, value } = schema.validate(queryData);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      const result = await this.referralService.getReferralNetwork(
        value.userId,
        value.page,
        value.limit
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/referral/earnings
   * Show breakdown of earnings per referred user
   */
  getEarningsBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(apiConfig.defaultPagination.maxLimit).default(20),
      });

      const queryData = {
        userId: req.params.userId || req.query.userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const { error, value } = schema.validate(queryData);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      // Validate date range
      if (value.startDate && value.endDate && value.startDate > value.endDate) {
        res.status(400).json({
          success: false,
          error: 'INVALID_DATE_RANGE',
          message: errorMessages.INVALID_DATE_RANGE,
        });
        return;
      }

      const result = await this.referralService.getEarningsBreakdown(value);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/referral/claim
   * Validate claimable amount (UI only - no implementation needed)
   */
  validateClaimRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
        tokenType: Joi.string().valid('USDC', 'USDT', 'SOL', 'ETH').default('USDC'),
        walletAddress: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      const result = await this.referralService.validateClaimRequest(
        value.userId,
        value.tokenType
      );

      if (!result.isValid) {
        res.status(400).json({
          success: false,
          error: 'INVALID_CLAIM_REQUEST',
          message: result.errors.join(', '),
          data: {
            claimableAmount: result.claimableAmount.toString(),
            errors: result.errors,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Claim request is valid',
        data: {
          claimableAmount: result.claimableAmount.toString(),
          tokenType: value.tokenType,
          walletAddress: value.walletAddress,
          estimatedGasFee: '0.001', // Mock value
          estimatedProcessingTime: '2-5 minutes', // Mock value
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/webhook/trade
   * Accept trade data and calculate/distribute commissions
   */
  processTradeWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
        tradeType: Joi.string().valid('SPOT', 'FUTURES', 'OPTIONS').default('SPOT'),
        baseAsset: Joi.string().required(),
        quoteAsset: Joi.string().required(),
        side: Joi.string().valid('BUY', 'SELL').required(),
        volume: Joi.string().pattern(/^\d+(\.\d+)?$/).required(), // String to handle large numbers
        price: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
        chain: Joi.string().valid('EVM', 'SVM').required(),
        network: Joi.string().valid('Arbitrum', 'Ethereum', 'Polygon', 'Solana').required(),
        transactionHash: Joi.string().optional(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      // Validate network matches chain
      const validNetworks = {
        EVM: ['Arbitrum', 'Ethereum', 'Polygon'],
        SVM: ['Solana'],
      };

      if (!validNetworks[value.chain as keyof typeof validNetworks].includes(value.network)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_NETWORK_CHAIN_COMBINATION',
          message: `Network ${value.network} is not valid for chain ${value.chain}`,
        });
        return;
      }

      const result = await this.referralService.processTradeWebhook(value);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/referral/statistics
   * Get platform-wide referral statistics (admin endpoint)
   */
  getPlatformStatistics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // This would typically require admin authentication
      // For now, we'll assume the user is authenticated and authorized

      const result = await this.referralService.getPlatformStatistics();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/referral/fee-tier/:userId
   * Update user's fee tier based on volume
   */
  updateUserFeeTier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        userId: Joi.string().uuid().required(),
      });

      const { error, value } = schema.validate({ userId: req.params.userId });
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
        });
        return;
      }

      const result = await this.referralService.updateUserFeeTier(value.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: result.updated ? 'Fee tier updated successfully' : 'Fee tier is already optimal',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/referral/validate-code/:code
   * Validate if a referral code exists and is valid
   */
  validateReferralCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schema = Joi.object({
        code: Joi.string().length(8).pattern(/^NIKA[A-Z0-9]{4}$/).required(),
      });

      const { error, value } = schema.validate({ code: req.params.code });
      if (error) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid referral code format',
        });
        return;
      }

      // This would be implemented in the service
      // For now, we'll just validate the format
      const isValid = value.code.startsWith('NIKA') && value.code.length === 8;

      res.status(200).json({
        success: true,
        data: {
          code: value.code,
          isValid,
          message: isValid ? 'Referral code is valid' : 'Referral code not found',
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Clean up controller resources
   */
  async cleanup(): Promise<void> {
    await this.referralService.cleanup();
  }
}

/**
 * Error handling middleware specifically for referral controllers
 */
export const referralErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Referral Controller Error:', err);

  // Check if it's a known API error
  if (ErrorUtils.isApiError(err)) {
    const statusCode = getStatusCodeForError(err.code);
    res.status(statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Database errors
  if (err.code?.startsWith('P')) {
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Database operation failed',
    });
    return;
  }

  // Generic server error
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: errorMessages.INTERNAL_SERVER_ERROR,
  });
};

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeForError(errorCode: string): number {
  const errorStatusMap: Record<string, number> = {
    // 400 Bad Request
    'VALIDATION_ERROR': 400,
    'INVALID_EMAIL': 400,
    'INVALID_USERNAME': 400,
    'INVALID_PASSWORD': 400,
    'INVALID_REFERRAL_CODE': 400,
    'INVALID_DATE_RANGE': 400,
    'INVALID_PAGINATION_PARAMS': 400,
    'MINIMUM_TRADE_VOLUME_NOT_MET': 400,
    'SELF_REFERRAL_NOT_ALLOWED': 400,
    'CIRCULAR_REFERRAL_DETECTED': 400,
    'MAX_REFERRAL_DEPTH_EXCEEDED': 400,
    'ALREADY_REFERRED': 400,
    'INSUFFICIENT_COMMISSION_BALANCE': 400,
    'COMMISSION_ALREADY_CLAIMED': 400,
    'INVALID_CLAIM_REQUEST': 400,

    // 401 Unauthorized
    'INVALID_CREDENTIALS': 401,
    'TOKEN_EXPIRED': 401,
    'TOKEN_INVALID': 401,
    'UNAUTHORIZED': 401,

    // 404 Not Found
    'USER_NOT_FOUND': 404,
    'REFERRAL_CODE_NOT_FOUND': 404,
    'COMMISSION_NOT_FOUND': 404,
    'TRADE_NOT_FOUND': 404,

    // 409 Conflict
    'EMAIL_EXISTS': 409,
    'EMAIL_ALREADY_EXISTS': 409,
    'USERNAME_EXISTS': 409,
    'USERNAME_ALREADY_EXISTS': 409,
    'REFERRAL_CODE_EXISTS': 409,
    'TRADE_ALREADY_PROCESSED': 409,

    // 429 Too Many Requests
    'RATE_LIMIT_EXCEEDED': 429,

    // 500 Internal Server Error
    'INTERNAL_SERVER_ERROR': 500,
    'DATABASE_ERROR': 500,
    'EXTERNAL_SERVICE_ERROR': 500,
    'REFERRAL_CODE_GENERATION_FAILED': 500,
  };

  return errorStatusMap[errorCode] || 500;
}
