import { Decimal } from 'decimal.js';
import { CommissionConfig, CustomCommissionStructure } from '../types';

// Environment Variables
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  api: {
    version: process.env.API_VERSION || 'v1',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Referral System Configuration
export const referralConfig: CommissionConfig = {
  maxDepth: parseInt(process.env.MAX_REFERRAL_DEPTH || '3'),
  rates: {
    level1: parseFloat(process.env.DEFAULT_DIRECT_COMMISSION_RATE || '0.30'),
    level2: parseFloat(process.env.DEFAULT_LEVEL2_COMMISSION_RATE || '0.03'),
    level3: parseFloat(process.env.DEFAULT_LEVEL3_COMMISSION_RATE || '0.02'),
  },
  defaultFeeDiscount: parseFloat(process.env.DEFAULT_FEE_DISCOUNT_RATE || '0.10'),
  baseFeeRate: parseFloat(process.env.BASE_FEE_TIER_RATE || '0.01'),
};

// Fee Tier Definitions
export const feeTierDefinitions = [
  {
    name: 'BASE',
    minimumVolume: new Decimal(0),
    feeRate: new Decimal(0.01), // 1%
    priority: 0,
    description: 'Base tier for all new users',
  },
  {
    name: 'TIER1',
    minimumVolume: new Decimal(10000), // $10k volume
    feeRate: new Decimal(0.008), // 0.8%
    priority: 1,
    description: 'Bronze tier for active traders',
  },
  {
    name: 'TIER2',
    minimumVolume: new Decimal(50000), // $50k volume
    feeRate: new Decimal(0.006), // 0.6%
    priority: 2,
    description: 'Silver tier for high-volume traders',
  },
  {
    name: 'TIER3',
    minimumVolume: new Decimal(200000), // $200k volume
    feeRate: new Decimal(0.005), // 0.5%
    priority: 3,
    description: 'Gold tier for premium traders',
  },
  {
    name: 'VIP',
    minimumVolume: new Decimal(1000000), // $1M volume
    feeRate: new Decimal(0.003), // 0.3%
    priority: 4,
    description: 'VIP tier for institutional traders',
  },
];

// Custom Commission Structures
export const customCommissionStructures: Record<string, CustomCommissionStructure> = {
  KOL_50: {
    level1Rate: 0.50, // 50% commission for KOLs
    level2Rate: 0.03, // Standard level 2
    level3Rate: 0.02, // Standard level 3
    type: 'KOL_50',
    description: 'Key Opinion Leader with 50% direct commission',
  },
  
  KOL_CUSTOM_HIGH: {
    level1Rate: 0.40, // 40% commission
    level2Rate: 0.05, // 5% level 2
    level3Rate: 0.03, // 3% level 3
    type: 'KOL_CUSTOM',
    description: 'High-tier KOL with enhanced multi-level commissions',
  },
  
  KOL_CUSTOM_BALANCED: {
    level1Rate: 0.35, // 35% commission
    level2Rate: 0.04, // 4% level 2
    level3Rate: 0.025, // 2.5% level 3
    type: 'KOL_CUSTOM',
    description: 'Balanced KOL structure with good multi-level incentives',
  },
};

// Supported Tokens and Chains
export const supportedTokens = ['USDC', 'USDT', 'SOL', 'ETH'] as const;
export const supportedChains = ['EVM', 'SVM'] as const;
export const supportedNetworks = {
  EVM: ['Arbitrum', 'Ethereum', 'Polygon'],
  SVM: ['Solana'],
} as const;

// Business Rules
export const businessRules = {
  // Maximum referral depth - prevents infinite chains
  maxReferralDepth: 3,
  
  // Minimum amounts for various operations (in USDC)
  minimumTradeVolume: new Decimal(10), // $10 minimum trade
  minimumClaimAmount: new Decimal(1), // $1 minimum claim
  minimumCommissionAmount: new Decimal(0.01), // $0.01 minimum commission
  
  // Rate limits and constraints
  maxReferralsPerUser: 10000, // Practical limit for network size
  maxClaimsPerDay: 10, // Prevent spam claiming
  maxTradesPerSecond: 100, // Rate limiting for trade webhook
  
  // Fee calculation rules
  feeCalculationRounding: 8, // Decimal places for fee calculations
  commissionCalculationRounding: 8, // Decimal places for commission calculations
  
  // Referral code generation
  referralCodeLength: 8,
  referralCodePrefix: 'NIKA',
  
  // Time-based rules
  commissionClaimCooldown: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  referralLinkExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  
  // Performance optimization
  networkCacheTimeout: 5 * 60 * 1000, // 5 minutes for network stats cache
  earningsCacheTimeout: 2 * 60 * 1000, // 2 minutes for earnings cache
};

// API Configuration
export const apiConfig = {
  defaultPagination: {
    page: 1,
    limit: 20,
    maxLimit: 100,
  },
  
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // requests per window
    skipSuccessfulRequests: false,
  },
  
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  },
};

// Validation Rules
export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
  },
  
  username: {
    pattern: /^[a-zA-Z0-9_-]+$/,
    minLength: 3,
    maxLength: 30,
  },
  
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
  
  referralCode: {
    pattern: /^[A-Z0-9]+$/,
    exactLength: referralConfig.maxDepth,
  },
  
  tradeVolume: {
    min: businessRules.minimumTradeVolume,
    max: new Decimal(1000000000), // $1B max per trade
  },
  
  pagination: {
    maxLimit: apiConfig.defaultPagination.maxLimit,
    defaultLimit: apiConfig.defaultPagination.limit,
  },
};

// Error Messages
export const errorMessages = {
  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  UNAUTHORIZED: 'Authentication required',
  
  // Referral System
  REFERRAL_CODE_NOT_FOUND: 'Referral code not found',
  REFERRAL_CODE_EXISTS: 'Referral code already exists for this user',
  SELF_REFERRAL_NOT_ALLOWED: 'Users cannot refer themselves',
  CIRCULAR_REFERRAL_DETECTED: 'Circular referral detected',
  MAX_REFERRAL_DEPTH_EXCEEDED: 'Maximum referral depth exceeded',
  ALREADY_REFERRED: 'User has already been referred',
  
  // Commission System  
  INSUFFICIENT_COMMISSION_BALANCE: 'Insufficient commission balance for claim',
  COMMISSION_ALREADY_CLAIMED: 'Commission has already been claimed',
  COMMISSION_NOT_FOUND: 'Commission not found',
  INVALID_COMMISSION_LEVEL: 'Invalid commission level',
  
  // Trade System
  TRADE_NOT_FOUND: 'Trade not found',
  INVALID_TRADE_DATA: 'Invalid trade data provided',
  TRADE_ALREADY_PROCESSED: 'Trade has already been processed',
  MINIMUM_TRADE_VOLUME_NOT_MET: 'Trade volume below minimum threshold',
  
  // User Management
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email address already registered',
  USERNAME_ALREADY_EXISTS: 'Username already taken',
  INVALID_USER_DATA: 'Invalid user data provided',
  
  // Validation
  VALIDATION_ERROR: 'Validation error',
  INVALID_PAGINATION_PARAMS: 'Invalid pagination parameters',
  INVALID_DATE_RANGE: 'Invalid date range provided',
  INVALID_SORT_PARAMS: 'Invalid sort parameters',
  
  // System
  INTERNAL_SERVER_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database operation failed',
  EXTERNAL_SERVICE_ERROR: 'External service unavailable',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
};

export default {
  config,
  referralConfig,
  feeTierDefinitions,
  customCommissionStructures,
  supportedTokens,
  supportedChains,
  supportedNetworks,
  businessRules,
  apiConfig,
  validationRules,
  errorMessages,
};
