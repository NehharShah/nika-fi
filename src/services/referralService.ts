import { Decimal } from 'decimal.js';
import { DatabaseService } from './database';
import { CommissionCalculator } from '../utils/commissionCalculator';
import {
  ReferralCodeGenerator,
  PasswordUtils,
  TokenUtils,
  ErrorUtils,
  ValidationUtils,
  DecimalUtils,
  PaginationUtils,
} from '../utils/helpers';
import {
  User,
  Commission,
  Trade,
  Claim,
  FeeTier,
  GenerateReferralCodeRequest,
  GenerateReferralCodeResponse,
  RegisterWithReferralRequest,
  RegisterWithReferralResponse,
  ReferralNetworkResponse,
  EarningsBreakdownRequest,
  EarningsBreakdownResponse,
  TradeWebhookRequest,
  TradeWebhookResponse,
  FeeCalculationResult,
  CommissionDistribution,
  CreateUserData,
  CommissionStatus,
  TradeStatus,
  ClaimStatus,
} from '../types';
import { referralConfig, businessRules, errorMessages } from '../config';

/**
 * Referral Service - Core business logic for the referral system
 *
 * This service orchestrates all referral-related operations including:
 * - User registration with referral codes
 * - Commission calculation and distribution
 * - Referral network management
 * - Earnings tracking and reporting
 */
export class ReferralService {
  private db: DatabaseService;
  private feeTiers: FeeTier[] = [];

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
    await this.loadFeeTiers();
  }

  /**
   * Load fee tiers from database
   */
  private async loadFeeTiers(): Promise<void> {
    this.feeTiers = await this.db.getFeeTiers();
  }

  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(
    request: GenerateReferralCodeRequest
  ): Promise<GenerateReferralCodeResponse> {
    const { userId } = request;

    // Check if user exists
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw ErrorUtils.createApiError('USER_NOT_FOUND', errorMessages.USER_NOT_FOUND);
    }

    // Check if user already has a referral code
    if (user.referralCode) {
      return {
        referralCode: user.referralCode,
        referralUrl: ReferralCodeGenerator.generateUrl(user.referralCode),
      };
    }

    // Generate new referral code (retry if collision occurs)
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const referralCode = ReferralCodeGenerator.generate();

      // Check if code already exists
      const existingUser = await this.db.findUserByReferralCode(referralCode);
      if (!existingUser) {
        // Update user with new referral code
        await this.db.updateUser(userId, { referralCode });

        return {
          referralCode,
          referralUrl: ReferralCodeGenerator.generateUrl(referralCode),
        };
      }

      attempts++;
    }

    throw ErrorUtils.createApiError(
      'REFERRAL_CODE_GENERATION_FAILED',
      'Failed to generate unique referral code'
    );
  }

  /**
   * Register a new user with optional referral code
   */
  async registerWithReferral(
    request: RegisterWithReferralRequest
  ): Promise<RegisterWithReferralResponse> {
    const { email, username, password, referralCode } = request;

    // Validate input
    if (!ValidationUtils.isValidEmail(email)) {
      throw ErrorUtils.createApiError('INVALID_EMAIL', 'Invalid email address');
    }

    if (username && !ValidationUtils.isValidUsername(username)) {
      throw ErrorUtils.createApiError('INVALID_USERNAME', 'Invalid username');
    }

    const passwordValidation = PasswordUtils.validate(password);
    if (!passwordValidation.isValid) {
      throw ErrorUtils.createApiError('INVALID_PASSWORD', passwordValidation.errors.join(', '));
    }

    // Validate referral code if provided
    let referrer: User | null = null;
    let feeDiscountRate = new Decimal(0);

    if (referralCode) {
      if (!ReferralCodeGenerator.isValid(referralCode)) {
        throw ErrorUtils.createApiError('INVALID_REFERRAL_CODE', 'Invalid referral code format');
      }

      referrer = await this.db.findUserByReferralCode(referralCode);
      if (!referrer) {
        throw ErrorUtils.createApiError(
          'REFERRAL_CODE_NOT_FOUND',
          errorMessages.REFERRAL_CODE_NOT_FOUND
        );
      }

      // Prevent self-referral by email if account already exists
      const existing = await this.db.findUserByEmail(email);
      if (existing && existing.id === referrer.id) {
        throw ErrorUtils.createApiError(
          'SELF_REFERRAL_NOT_ALLOWED',
          errorMessages.SELF_REFERRAL_NOT_ALLOWED
        );
      }

      // Validate referral chain depth
      const referralChain = await this.db.getReferralChain(referrer.id);
      if (referralChain.length >= businessRules.maxReferralDepth) {
        throw ErrorUtils.createApiError(
          'MAX_REFERRAL_DEPTH_EXCEEDED',
          errorMessages.MAX_REFERRAL_DEPTH_EXCEEDED
        );
      }

      // Apply fee discount for referred users
      feeDiscountRate = new Decimal(referralConfig.defaultFeeDiscount);
    }

    // Hash password
    const passwordHash = await PasswordUtils.hash(password);

    // Create user data
    const userData: CreateUserData = {
      email,
      username,
      password,
      referrerId: referrer?.id,
      feeDiscountRate,
    };

    // Create user in database
    const user = await this.db.createUser({
      ...userData,
      passwordHash,
    } as any);

    // Generate referral code for new user
    const newReferralCode = ReferralCodeGenerator.generate();
    await this.db.updateUser(user.id, { referralCode: newReferralCode });

    // Generate JWT token
    const token = TokenUtils.generate({
      userId: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        referralCode: newReferralCode,
        referrerId: user.referrerId,
        feeDiscountRate: DecimalUtils.toNumber(feeDiscountRate),
      },
      token,
    };
  }

  /**
   * Get user's referral network (3 levels deep)
   */
  async getReferralNetwork(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ReferralNetworkResponse> {
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw ErrorUtils.createApiError('USER_NOT_FOUND', errorMessages.USER_NOT_FOUND);
    }

    const pagination = PaginationUtils.calculatePagination(page, limit);

    // Build the network tree recursively
    const networkNode = await this.buildNetworkNode(user, 1, 3, pagination);

    return networkNode;
  }

  /**
   * Build a referral network node recursively
   */
  private async buildNetworkNode(
    user: User,
    currentLevel: number,
    maxLevel: number,
    pagination: { page: number; limit: number; offset: number }
  ): Promise<ReferralNetworkResponse> {
    // Get user's commission stats
    const commissionStats = await this.db.getCommissionStats(user.id);

    const node: ReferralNetworkResponse = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        level: currentLevel,
        joinedAt: user.createdAt,
        totalVolume: user.totalTradeVolume,
        totalCommissions: commissionStats.totalEarned,
      },
      children: [],
    };

    // If we haven't reached max level, get children
    if (currentLevel < maxLevel) {
      const { referrals } = await this.db.getUserReferrals(user.id, pagination);

      // Build children nodes recursively
      for (const referral of referrals) {
        const childNode = await this.buildNetworkNode(
          referral,
          currentLevel + 1,
          maxLevel,
          pagination
        );
        node.children.push(childNode);
      }
    }

    return node;
  }

  /**
   * Get earnings breakdown for a user
   */
  async getEarningsBreakdown(
    request: EarningsBreakdownRequest
  ): Promise<EarningsBreakdownResponse> {
    const { userId, startDate, endDate, page = 1, limit = 20 } = request;

    // Validate user
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw ErrorUtils.createApiError('USER_NOT_FOUND', errorMessages.USER_NOT_FOUND);
    }

    // Validate date range
    if (!ValidationUtils.isValidDateRange(startDate, endDate)) {
      throw ErrorUtils.createApiError('INVALID_DATE_RANGE', errorMessages.INVALID_DATE_RANGE);
    }

    const pagination = PaginationUtils.calculatePagination(page, limit);
    const filters = { startDate, endDate };

    // Get commissions with pagination
    const { commissions, total } = await this.db.getUserCommissions(userId, filters, pagination);

    // Calculate earnings stats
    const commissionStats = await this.db.getCommissionStats(userId);

    // Group earnings by user
    const earningsByUserMap = new Map<
      string,
      {
        userId: string;
        username?: string;
        email: string;
        level: number;
        totalEarnings: Decimal;
        unclaimedEarnings: Decimal;
        lastTradeAt?: Date;
      }
    >();

    for (const commission of commissions) {
      const sourceUserId = commission.sourceUserId;

      if (!earningsByUserMap.has(sourceUserId)) {
        // This would need the source user data from the commission query
        // For now, we'll create a placeholder
        earningsByUserMap.set(sourceUserId, {
          userId: sourceUserId,
          email: 'user@example.com', // Would come from join
          level: commission.commissionLevel,
          totalEarnings: new Decimal(0),
          unclaimedEarnings: new Decimal(0),
        });
      }

      const userEarnings = earningsByUserMap.get(sourceUserId)!;
      userEarnings.totalEarnings = userEarnings.totalEarnings.add(commission.amount);

      if (commission.status === CommissionStatus.UNCLAIMED) {
        userEarnings.unclaimedEarnings = userEarnings.unclaimedEarnings.add(commission.amount);
      }
    }

    const paginationMeta = PaginationUtils.calculateMeta(page, limit, total);

    return {
      totalEarnings: {
        unclaimed: commissionStats.totalUnclaimed,
        claimed: commissionStats.totalClaimed,
        total: commissionStats.totalEarned,
      },
      earningsByLevel: {
        level1: commissionStats.earningsByLevel[1] || new Decimal(0),
        level2: commissionStats.earningsByLevel[2] || new Decimal(0),
        level3: commissionStats.earningsByLevel[3] || new Decimal(0),
      },
      earningsByUser: Array.from(earningsByUserMap.values()),
      pagination: {
        page: paginationMeta.page,
        limit: paginationMeta.limit,
        total: paginationMeta.totalItems,
        totalPages: paginationMeta.totalPages,
      },
    };
  }

  /**
   * Process a trade and distribute commissions
   */
  async processTradeWebhook(request: TradeWebhookRequest): Promise<TradeWebhookResponse> {
    const {
      userId,
      tradeType,
      baseAsset,
      quoteAsset,
      side,
      volume,
      price,
      chain,
      network,
      transactionHash,
    } = request;

    // Validate user
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw ErrorUtils.createApiError('USER_NOT_FOUND', errorMessages.USER_NOT_FOUND);
    }

    // Validate and convert trade volume
    const tradeVolume = DecimalUtils.fromString(volume, 'volume');
    const tradePrice = DecimalUtils.fromString(price, 'price');

    if (tradeVolume.lt(businessRules.minimumTradeVolume)) {
      throw ErrorUtils.createApiError(
        'MINIMUM_TRADE_VOLUME_NOT_MET',
        errorMessages.MINIMUM_TRADE_VOLUME_NOT_MET
      );
    }

    // Calculate trade value
    const tradeValue = tradeVolume.mul(tradePrice);

    return this.db.executeTransaction(async (tx) => {
      // Calculate effective fee rate
      const feeCalculation = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeValue,
        this.feeTiers
      );

      // Create trade record (tx-aware)
      const trade = await (tx as any).trade.create({
        data: {
          userId,
          tradeType,
          baseAsset,
          quoteAsset,
          side,
          volume: tradeVolume,
          price: tradePrice,
          feeRate: feeCalculation.appliedFeeRate,
          feeAmount: feeCalculation.feeAmount,
          netFeeAmount: feeCalculation.netFeeAmount,
          rebateAmount: feeCalculation.rebateAmount,
          chain,
          network,
          transactionHash,
          status: TradeStatus.COMPLETED,
          settledAt: new Date(),
        },
      });

      // Get referral chain
      const referralChain = await this.db.getReferralChain(userId);

      // Calculate commission distribution
      const commissionDistributions = await CommissionCalculator.calculateCommissionDistribution(
        trade,
        user,
        referralChain,
        feeCalculation
      );

      // Create commission records
      const commissionsData = commissionDistributions.map((distribution) => ({
        amount: distribution.amount,
        tokenType: 'USDC', // Default token
        commissionLevel: distribution.level,
        rate: distribution.rate,
        earnerId: distribution.earnerId,
        sourceUserId: userId,
        tradeId: trade.id,
        originalFeeAmount: feeCalculation.feeAmount,
        status: CommissionStatus.UNCLAIMED,
      }));

      let createdCommissions: Commission[] = [];
      if (commissionsData.length > 0) {
        // Create commission records in same transaction
        const created = await Promise.all(
          commissionsData.map((data) => (tx as any).commission.create({ data }))
        );
        createdCommissions = created as any;

        // Update commission IDs in distributions
        commissionDistributions.forEach((distribution, index) => {
          distribution.commissionId = createdCommissions[index].id;
        });
      }

      // Update user's trade volume
      const updatedVolume = user.totalTradeVolume.add(tradeValue);
      const updatedFees = user.totalFeesPaid.add(feeCalculation.netFeeAmount);

      await (tx as any).user.update({
        where: { id: userId },
        data: {
          totalTradeVolume: updatedVolume,
          totalFeesPaid: updatedFees,
          lastActiveAt: new Date(),
        },
      });

      return {
        tradeId: trade.id,
        status: 'SUCCESS',
        commissionsDistributed: commissionDistributions,
      };
    });
  }

  /**
   * Validate claim request (UI endpoint - no actual processing)
   */
  async validateClaimRequest(
    userId: string,
    tokenType: string = 'USDC'
  ): Promise<{
    isValid: boolean;
    claimableAmount: Decimal;
    errors: string[];
  }> {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return {
        isValid: false,
        claimableAmount: new Decimal(0),
        errors: [errorMessages.USER_NOT_FOUND],
      };
    }

    // Get unclaimed commissions
    const { commissions } = await this.db.getUserCommissions(
      userId,
      { status: CommissionStatus.UNCLAIMED, tokenType },
      { page: 1, limit: 1000, offset: 0 }
    );

    const claimableAmount = commissions.reduce(
      (sum, commission) => sum.add(commission.amount),
      new Decimal(0)
    );

    const errors: string[] = [];

    if (claimableAmount.lt(businessRules.minimumClaimAmount)) {
      errors.push(`Minimum claim amount is ${businessRules.minimumClaimAmount} ${tokenType}`);
    }

    return {
      isValid: errors.length === 0,
      claimableAmount,
      errors,
    };
  }

  /**
   * Get platform statistics (admin endpoint)
   */
  async getPlatformStatistics(): Promise<{
    totalUsers: number;
    totalTrades: number;
    totalVolume: Decimal;
    totalCommissions: Decimal;
    activeReferrers: number;
    topReferrers: Array<{
      userId: string;
      email: string;
      username?: string;
      totalEarnings: Decimal;
      referralCount: number;
    }>;
  }> {
    const [platformStats, topReferrers] = await Promise.all([
      this.db.getPlatformStats(),
      this.db.getTopReferrers(10),
    ]);

    return {
      ...platformStats,
      topReferrers,
    };
  }

  /**
   * Update user's fee tier based on volume
   */
  async updateUserFeeTier(
    userId: string
  ): Promise<{ oldTier: string; newTier: string; updated: boolean }> {
    const user = await this.db.findUserById(userId);
    if (!user) {
      throw ErrorUtils.createApiError('USER_NOT_FOUND', errorMessages.USER_NOT_FOUND);
    }

    const optimalTier = CommissionCalculator.calculateOptimalFeeTier(
      user.totalTradeVolume,
      this.feeTiers
    );

    if (optimalTier.name !== user.feeTier) {
      await this.db.updateUser(userId, { feeTier: optimalTier.name });
      return {
        oldTier: user.feeTier,
        newTier: optimalTier.name,
        updated: true,
      };
    }

    return {
      oldTier: user.feeTier,
      newTier: user.feeTier,
      updated: false,
    };
  }

  /**
   * Clean up service resources
   */
  async cleanup(): Promise<void> {
    await this.db.disconnect();
  }
}
