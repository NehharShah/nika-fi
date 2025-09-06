import { Router, Request, Response, NextFunction } from 'express';
import { ReferralController, referralErrorHandler } from '../controllers/referralController';
import {
  authenticateToken,
  validateUserAccess,
  optionalAuth,
  requireAdmin,
  validateApiKey,
  rateLimitByUser,
} from '../middleware/auth';
import {
  validate,
  validatePagination,
  validateDateRange,
  validateSortParams,
  validateUuid,
  validateReferralCode,
  validateContentType,
  sanitizeInput,
  commonSchemas,
} from '../middleware/validation';

/**
 * Referral Routes
 * 
 * Defines all HTTP routes for the referral system with appropriate middleware
 */

const router: Router = Router();
const referralController = new ReferralController();

// Initialize controller
referralController.initialize().catch(console.error);

/**
 * PUBLIC ROUTES (No authentication required)
 */

// Validate referral code format and existence
router.get(
  '/validate-code/:code',
  validateReferralCode,
  referralController.validateReferralCode
);

// Register new user with referral code
router.post(
  '/register',
  validateContentType(),
  sanitizeInput,
  validate(commonSchemas.userRegistration),
  rateLimitByUser(10, 15 * 60 * 1000), // 10 registrations per 15 minutes
  referralController.registerWithReferral
);

/**
 * AUTHENTICATED ROUTES (Require valid JWT token)
 */

// Generate referral code for authenticated user
router.post(
  '/generate',
  authenticateToken,
  validateContentType(),
  extractUserId,
  rateLimitByUser(5, 60 * 1000), // 5 generations per minute
  referralController.generateReferralCode
);

// Get user's referral network
router.get(
  '/network/:userId?',
  authenticateToken,
  validateUserAccess,
  validatePagination,
  rateLimitByUser(20, 60 * 1000), // 20 requests per minute
  referralController.getReferralNetwork
);

// Get earnings breakdown for user
router.get(
  '/earnings/:userId?',
  authenticateToken,
  validateUserAccess,
  validatePagination,
  validateDateRange,
  validateSortParams(['createdAt', 'amount', 'commissionLevel']),
  rateLimitByUser(30, 60 * 1000), // 30 requests per minute
  referralController.getEarningsBreakdown
);

// Validate claim request (UI only)
router.post(
  '/claim',
  authenticateToken,
  validateContentType(),
  sanitizeInput,
  validate(commonSchemas.claimRequest),
  rateLimitByUser(10, 60 * 1000), // 10 claims per minute
  referralController.validateClaimRequest
);

// Update user's fee tier
router.put(
  '/fee-tier/:userId',
  authenticateToken,
  validateUuid('userId'),
  validateUserAccess,
  rateLimitByUser(5, 60 * 1000), // 5 updates per minute
  referralController.updateUserFeeTier
);

/**
 * ADMIN ROUTES (Require admin privileges)
 */

// Get platform-wide statistics
router.get(
  '/statistics',
  authenticateToken,
  requireAdmin,
  rateLimitByUser(100, 60 * 1000), // 100 requests per minute for admins
  referralController.getPlatformStatistics
);

/**
 * WEBHOOK ROUTES (Require API key authentication)
 */

// Process trade and distribute commissions
router.post(
  '/trade',
  validateApiKey,
  validateContentType(),
  sanitizeInput,
  validate(commonSchemas.tradeWebhook),
  rateLimitByUser(1000, 60 * 1000), // 1000 trades per minute
  referralController.processTradeWebhook
);

/**
 * UTILITY MIDDLEWARE
 */

// Helper middleware to extract userId from various sources
function extractUserId(req: any, res: any, next: any): void {
  // Try to get userId from params, body, or query
  let userId = req.params.userId || req.body.userId || req.query.userId;
  
  // If no userId provided and user is authenticated, use their ID
  if (!userId && req.user) {
    userId = req.user.id;
    req.body.userId = userId; // Ensure it's in body for controller access
  }

  next();
}

// Error handling middleware for referral routes
router.use(referralErrorHandler);

export default router;
