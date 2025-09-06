import { Decimal } from 'decimal.js';

// Core Types
export interface User {
  id: string;
  email: string;
  username?: string;
  referralCode: string;
  referrerId?: string;
  feeTier: string;
  customFeeRate?: Decimal;
  feeDiscountRate: Decimal;
  customCommissionStructure?: CustomCommissionStructure;
  isTeamMember: boolean;
  isWaivedFees: boolean;
  totalXpEarned: Decimal;
  totalTradeVolume: Decimal;
  totalFeesPaid: Decimal;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface CustomCommissionStructure {
  level1Rate?: number; // Direct referral commission rate
  level2Rate?: number; // Second level commission rate  
  level3Rate?: number; // Third level commission rate
  type: 'KOL_50' | 'KOL_CUSTOM' | 'STANDARD';
  description?: string;
}

export interface Commission {
  id: string;
  amount: Decimal;
  tokenType: string;
  commissionLevel: number;
  rate: Decimal;
  earnerId: string;
  sourceUserId: string;
  tradeId: string;
  originalFeeAmount: Decimal;
  status: CommissionStatus;
  claimedAt?: Date;
  claimId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  userId: string;
  tradeType: string;
  baseAsset: string;
  quoteAsset: string;
  side: string;
  volume: Decimal;
  price: Decimal;
  feeRate: Decimal;
  feeAmount: Decimal;
  netFeeAmount: Decimal;
  rebateAmount: Decimal;
  chain: string;
  network: string;
  transactionHash?: string;
  status: TradeStatus;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Claim {
  id: string;
  userId: string;
  totalAmount: Decimal;
  tokenType: string;
  transactionHash?: string;
  chain?: string;
  network?: string;
  walletAddress?: string;
  status: ClaimStatus;
  processedAt?: Date;
  failedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeTier {
  id: string;
  name: string;
  minimumVolume: Decimal;
  feeRate: Decimal;
  description?: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralNetwork {
  id: string;
  userId: string;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalNetworkSize: number;
  totalNetworkVolume: Decimal;
  totalCommissionsEarned: Decimal;
  lastCalculatedAt: Date;
}

// Enums
export enum CommissionStatus {
  UNCLAIMED = 'UNCLAIMED',
  CLAIMED = 'CLAIMED',
  PROCESSING = 'PROCESSING',
  FAILED = 'FAILED'
}

export enum TradeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum ClaimStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Request/Response Types
export interface GenerateReferralCodeRequest {
  userId: string;
}

export interface GenerateReferralCodeResponse {
  referralCode: string;
  referralUrl: string;
}

export interface RegisterWithReferralRequest {
  email: string;
  username?: string;
  password: string;
  referralCode?: string;
}

export interface RegisterWithReferralResponse {
  user: {
    id: string;
    email: string;
    username?: string;
    referralCode: string;
    referrerId?: string;
    feeDiscountRate: number;
  };
  token: string;
}

export interface ReferralNetworkResponse {
  user: {
    id: string;
    email: string;
    username?: string;
    level: number;
    joinedAt: Date;
    totalVolume: Decimal;
    totalCommissions: Decimal;
  };
  children: ReferralNetworkResponse[];
}

export interface EarningsBreakdownRequest {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface EarningsBreakdownResponse {
  totalEarnings: {
    unclaimed: Decimal;
    claimed: Decimal;
    total: Decimal;
  };
  earningsByLevel: {
    level1: Decimal;
    level2: Decimal;
    level3: Decimal;
  };
  earningsByUser: {
    userId: string;
    username?: string;
    email: string;
    level: number;
    totalEarnings: Decimal;
    unclaimedEarnings: Decimal;
    lastTradeAt?: Date;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TradeWebhookRequest {
  userId: string;
  tradeType: string;
  baseAsset: string;
  quoteAsset: string;
  side: string;
  volume: string; // String to handle large numbers
  price: string;
  chain: string;
  network: string;
  transactionHash?: string;
}

export interface TradeWebhookResponse {
  tradeId: string;
  status: string;
  commissionsDistributed: {
    level: number;
    earnerId: string;
    amount: Decimal;
    rate: Decimal;
  }[];
}

// Configuration Types
export interface CommissionConfig {
  maxDepth: number;
  rates: {
    level1: number;
    level2: number;
    level3: number;
  };
  defaultFeeDiscount: number;
  baseFeeRate: number;
}

export interface FeeCalculationResult {
  originalFeeRate: Decimal;
  appliedFeeRate: Decimal;
  feeAmount: Decimal;
  netFeeAmount: Decimal;
  rebateAmount: Decimal;
  discountApplied: boolean;
  tierUsed: string;
}

export interface CommissionDistribution {
  level: number;
  earnerId: string;
  earnerEmail: string;
  amount: Decimal;
  rate: Decimal;
  commissionId: string;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError extends ApiError {
  field: string;
  value: any;
}

// Utility Types
export type CreateUserData = Pick<User, 'email' | 'username' | 'referrerId' | 'feeDiscountRate'> & {
  password: string;
};

export type UpdateUserData = Partial<Pick<User, 'username' | 'feeTier' | 'customFeeRate' | 'customCommissionStructure' | 'referralCode' | 'totalTradeVolume' | 'totalFeesPaid' | 'lastActiveAt'>>;

export type PaginationParams = {
  page: number;
  limit: number;
  offset: number;
};

export type SortParams = {
  field: string;
  direction: 'asc' | 'desc';
};

export type FilterParams = {
  startDate?: Date;
  endDate?: Date;
  status?: CommissionStatus | TradeStatus | ClaimStatus;
  tokenType?: string;
  level?: number;
};
