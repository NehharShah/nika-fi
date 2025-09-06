import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationUtils } from '../utils/helpers';
import { apiConfig, errorMessages } from '../config';

/**
 * Validation Middleware
 * 
 * Provides request validation using Joi schemas and custom validators
 */

/**
 * Generic validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const { error, value } = schema.validate(data, {
        abortEarly: false, // Return all validation errors
        stripUnknown: true, // Remove unknown fields
        convert: true, // Convert types when possible
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));

        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors,
        });
        return;
      }

      // Replace the original data with validated/sanitized data
      req[source] = value;
      next();
    } catch (err) {
      console.error('Validation middleware error:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMessages.INTERNAL_SERVER_ERROR,
      });
    }
  };
};

/**
 * Pagination validation middleware
 */
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(apiConfig.defaultPagination.maxLimit).default(apiConfig.defaultPagination.limit),
    });

    const { error, value } = schema.validate({
      page: req.query.page,
      limit: req.query.limit,
    });

    if (error) {
      res.status(400).json({
        success: false,
        error: 'INVALID_PAGINATION_PARAMS',
        message: errorMessages.INVALID_PAGINATION_PARAMS,
        details: error.details[0].message,
      });
      return;
    }

    // Add pagination to query for easy access
    req.query.page = value.page.toString();
    req.query.limit = value.limit.toString();

    next();
  } catch (err) {
    console.error('Pagination validation error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Date range validation middleware
 */
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      // Check for invalid dates
      if (start && isNaN(start.getTime())) {
        res.status(400).json({
          success: false,
          error: 'INVALID_START_DATE',
          message: 'Invalid start date format',
        });
        return;
      }

      if (end && isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'INVALID_END_DATE',
          message: 'Invalid end date format',
        });
        return;
      }

      // Validate date range
      if (!ValidationUtils.isValidDateRange(start, end)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_DATE_RANGE',
          message: errorMessages.INVALID_DATE_RANGE,
        });
        return;
      }

      // Ensure dates are not in the future
      const now = new Date();
      if (start && start > now) {
        res.status(400).json({
          success: false,
          error: 'FUTURE_START_DATE',
          message: 'Start date cannot be in the future',
        });
        return;
      }

      if (end && end > now) {
        res.status(400).json({
          success: false,
          error: 'FUTURE_END_DATE',
          message: 'End date cannot be in the future',
        });
        return;
      }

      // Ensure date range is not too large (max 1 year)
      if (start && end) {
        const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
          res.status(400).json({
            success: false,
            error: 'DATE_RANGE_TOO_LARGE',
            message: 'Date range cannot exceed 365 days',
          });
          return;
        }
      }
    }

    next();
  } catch (err) {
    console.error('Date range validation error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Sort parameters validation middleware
 */
export const validateSortParams = (allowedFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { sortBy, sortOrder } = req.query;

      if (sortBy || sortOrder) {
        const sortParams = ValidationUtils.validateSortParams(
          sortBy as string || 'createdAt',
          sortOrder as string || 'desc',
          allowedFields
        );

        if (!sortParams) {
          res.status(400).json({
            success: false,
            error: 'INVALID_SORT_PARAMS',
            message: errorMessages.INVALID_SORT_PARAMS,
            allowedFields,
          });
          return;
        }

        // Add validated sort params to query
        req.query.sortBy = sortParams.field;
        req.query.sortOrder = sortParams.direction;
      }

      next();
    } catch (err) {
      console.error('Sort validation error:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMessages.INTERNAL_SERVER_ERROR,
      });
    }
  };
};

/**
 * UUID validation middleware
 */
export const validateUuid = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const uuid = req.params[paramName];
      
      if (!uuid) {
        res.status(400).json({
          success: false,
          error: 'MISSING_PARAMETER',
          message: `Missing required parameter: ${paramName}`,
        });
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_UUID',
          message: `Invalid UUID format for parameter: ${paramName}`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('UUID validation error:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMessages.INTERNAL_SERVER_ERROR,
      });
    }
  };
};

/**
 * Referral code validation middleware
 */
export const validateReferralCode = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const referralCode = req.params.code || req.body.referralCode || req.query.referralCode;

    if (referralCode) {
      const codeRegex = /^NIKA[A-Z0-9]{4}$/;
      if (!codeRegex.test(referralCode)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_REFERRAL_CODE_FORMAT',
          message: 'Referral code must be in format NIKAXXXX',
        });
        return;
      }
    }

    next();
  } catch (err) {
    console.error('Referral code validation error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: errorMessages.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Content-Type validation middleware
 */
export const validateContentType = (expectedType: string = 'application/json') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.method === 'GET' || req.method === 'DELETE') {
        next();
        return;
      }

      const contentType = req.headers['content-type'];
      
      if (!contentType || !contentType.includes(expectedType)) {
        res.status(415).json({
          success: false,
          error: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Expected Content-Type: ${expectedType}`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('Content-Type validation error:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMessages.INTERNAL_SERVER_ERROR,
      });
    }
  };
};

/**
 * Request size validation middleware
 */
export const validateRequestSize = (maxSizeBytes: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      
      if (contentLength > maxSizeBytes) {
        res.status(413).json({
          success: false,
          error: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds maximum of ${maxSizeBytes} bytes`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error('Request size validation error:', err);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMessages.INTERNAL_SERVER_ERROR,
      });
    }
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // User registration schema
  userRegistration: Joi.object({
    email: Joi.string().email().max(254).required(),
    username: Joi.string().alphanum().min(3).max(30).optional(),
    password: Joi.string().min(8).max(128).required(),
    referralCode: Joi.string().pattern(/^NIKA[A-Z0-9]{4}$/).optional(),
  }),

  // Trade webhook schema
  tradeWebhook: Joi.object({
    userId: Joi.string().uuid().required(),
    tradeType: Joi.string().valid('SPOT', 'FUTURES', 'OPTIONS').default('SPOT'),
    baseAsset: Joi.string().min(1).max(10).required(),
    quoteAsset: Joi.string().min(1).max(10).required(),
    side: Joi.string().valid('BUY', 'SELL').required(),
    volume: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
    price: Joi.string().pattern(/^\d+(\.\d+)?$/).required(),
    chain: Joi.string().valid('EVM', 'SVM').required(),
    network: Joi.string().valid('Arbitrum', 'Ethereum', 'Polygon', 'Solana').required(),
    transactionHash: Joi.string().optional(),
  }),

  // Claim request schema
  claimRequest: Joi.object({
    userId: Joi.string().uuid().required(),
    tokenType: Joi.string().valid('USDC', 'USDT', 'SOL', 'ETH').default('USDC'),
    walletAddress: Joi.string().required(),
    amount: Joi.string().pattern(/^\d+(\.\d+)?$/).optional(),
  }),

  // Pagination schema
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(apiConfig.defaultPagination.maxLimit).default(apiConfig.defaultPagination.limit),
  }),

  // Date range schema
  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
  }),

  // UUID parameter schema
  uuidParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

/**
 * Sanitization middleware
 */
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize string fields in body
    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          req.body[key] = ValidationUtils.sanitizeString(value);
        }
      }
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = ValidationUtils.sanitizeString(value);
        }
      }
    }

    next();
  } catch (err) {
    console.error('Input sanitization error:', err);
    next(); // Don't fail the request due to sanitization errors
  }
};
