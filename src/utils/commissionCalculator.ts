import { Decimal } from 'decimal.js';
import {
  User,
  Commission,
  Trade,
  FeeCalculationResult,
  CommissionDistribution,
  CustomCommissionStructure,
  FeeTier,
} from '../types';
import { referralConfig, feeTierDefinitions, businessRules } from '../config';

/**
 * Commission Calculator - Core business logic for the referral system
 *
 * This class handles all commission calculations including:
 * - Fee tier determination and fee discount application
 * - Multi-level commission distribution (3 levels deep)
 * - Custom commission structures for KOLs
 * - Special handling for team members and waived fees
 */
export class CommissionCalculator {
  /**
   * Calculate the effective fee rate for a user based on their tier and discounts
   *
   * Priority order:
   * 1. Custom fee rate (for special users)
   * 2. Fee tier rate (if better than base + discount)
   * 3. Base rate with signup discount applied
   */
  public static calculateEffectiveFeeRate(
    user: User,
    tradeVolume: Decimal,
    availableFeeTiers: FeeTier[]
  ): FeeCalculationResult {
    // Team members and waived fee users pay no fees
    if (user.isTeamMember || user.isWaivedFees) {
      return {
        originalFeeRate: new Decimal(0),
        appliedFeeRate: new Decimal(0),
        feeAmount: new Decimal(0),
        netFeeAmount: new Decimal(0),
        rebateAmount: new Decimal(0),
        discountApplied: false,
        tierUsed: 'WAIVED',
      };
    }

    // Use custom fee rate if defined
    if (user.customFeeRate) {
      const feeAmount = tradeVolume.mul(user.customFeeRate);
      return {
        originalFeeRate: user.customFeeRate,
        appliedFeeRate: user.customFeeRate,
        feeAmount,
        netFeeAmount: feeAmount,
        rebateAmount: new Decimal(0),
        discountApplied: false,
        tierUsed: 'CUSTOM',
      };
    }

    // Determine the best applicable fee tier based on user's volume
    const baseFeeRate = new Decimal(referralConfig.baseFeeRate);
    const applicableTiers = availableFeeTiers
      .filter((tier) => tier.isActive)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    let bestTier: FeeTier | null = null;
    for (const tier of applicableTiers) {
      if (user.totalTradeVolume.gte(tier.minimumVolume)) {
        bestTier = tier;
        break;
      }
    }

    // Calculate base rate with signup discount
    const discountedBaseRate = baseFeeRate.mul(new Decimal(1).sub(user.feeDiscountRate));

    // Use the better rate between tier rate and discounted base rate
    let effectiveRate: Decimal;
    let tierUsed: string;
    let discountApplied = false;

    if (bestTier && bestTier.feeRate.lt(discountedBaseRate)) {
      // Fee tier is better than discounted base rate
      effectiveRate = bestTier.feeRate;
      tierUsed = bestTier.name;
    } else {
      // Use discounted base rate
      effectiveRate = discountedBaseRate;
      tierUsed = 'BASE';
      discountApplied = user.feeDiscountRate.gt(0);
    }

    const feeAmount = tradeVolume.mul(baseFeeRate); // Always charge base rate initially
    const netFeeAmount = tradeVolume.mul(effectiveRate);
    const rebateAmount = feeAmount.sub(netFeeAmount);

    return {
      originalFeeRate: baseFeeRate,
      appliedFeeRate: effectiveRate,
      feeAmount,
      netFeeAmount,
      rebateAmount,
      discountApplied,
      tierUsed,
    };
  }

  /**
   * Calculate commission distribution for a trade across the referral network
   *
   * Traverses up to 3 levels of the referral chain and calculates commissions
   * based on standard rates or custom commission structures.
   */
  public static async calculateCommissionDistribution(
    trade: Trade,
    trader: User,
    referralChain: User[],
    feeCalculationResult: FeeCalculationResult
  ): Promise<CommissionDistribution[]> {
    const distributions: CommissionDistribution[] = [];
    const netFeeAmount = feeCalculationResult.netFeeAmount;

    // Only distribute commissions if there's a net fee to work with
    if (netFeeAmount.lte(0)) {
      return distributions;
    }

    for (
      let level = 1;
      level <= Math.min(referralChain.length, businessRules.maxReferralDepth);
      level++
    ) {
      const referrer = referralChain[level - 1];

      // Skip team members as they don't earn commissions
      if (referrer.isTeamMember) {
        continue;
      }

      const commissionRate = this.getCommissionRate(referrer, level);
      const commissionAmount = netFeeAmount.mul(commissionRate);

      // Only create commission if amount meets minimum threshold
      if (commissionAmount.gte(businessRules.minimumCommissionAmount)) {
        distributions.push({
          level,
          earnerId: referrer.id,
          earnerEmail: referrer.email,
          amount: commissionAmount,
          rate: commissionRate,
          commissionId: '', // Will be set when commission is created
        });
      }
    }

    return distributions;
  }

  /**
   * Get the commission rate for a specific referrer at a given level
   *
   * Considers custom commission structures for KOLs and special users
   */
  private static getCommissionRate(referrer: User, level: number): Decimal {
    // Check for custom commission structure
    if (referrer.customCommissionStructure) {
      return this.getCustomCommissionRate(referrer.customCommissionStructure, level);
    }

    // Use standard rates
    switch (level) {
      case 1:
        return new Decimal(referralConfig.rates.level1);
      case 2:
        return new Decimal(referralConfig.rates.level2);
      case 3:
        return new Decimal(referralConfig.rates.level3);
      default:
        return new Decimal(0);
    }
  }

  /**
   * Get commission rate from custom commission structure
   */
  private static getCustomCommissionRate(
    customStructure: CustomCommissionStructure,
    level: number
  ): Decimal {
    switch (level) {
      case 1:
        return new Decimal(customStructure.level1Rate ?? referralConfig.rates.level1);
      case 2:
        return new Decimal(customStructure.level2Rate ?? referralConfig.rates.level2);
      case 3:
        return new Decimal(customStructure.level3Rate ?? referralConfig.rates.level3);
      default:
        return new Decimal(0);
    }
  }

  /**
   * Validate a referral chain to prevent circular references
   *
   * Ensures that a user cannot be referred by someone in their own referral chain
   */
  public static validateReferralChain(userId: string, referralChain: User[]): boolean {
    // Check if user is trying to refer themselves
    if (referralChain.some((user) => user.id === userId)) {
      return false;
    }

    // Check for circular references in the chain
    const userIds = new Set<string>();
    for (const user of referralChain) {
      if (userIds.has(user.id)) {
        return false; // Circular reference detected
      }
      userIds.add(user.id);
    }

    // Check maximum depth
    if (referralChain.length > businessRules.maxReferralDepth) {
      return false;
    }

    return true;
  }

  /**
   * Calculate total potential earnings for a user's referral network
   *
   * This is used for analytics and network performance metrics
   */
  public static calculateNetworkValue(
    networkUsers: User[],
    commissions: Commission[]
  ): {
    totalVolume: Decimal;
    totalCommissions: Decimal;
    averageCommissionRate: Decimal;
    networkSize: number;
  } {
    const totalVolume = networkUsers.reduce(
      (sum, user) => sum.add(user.totalTradeVolume),
      new Decimal(0)
    );

    const totalCommissions = commissions.reduce(
      (sum, commission) => sum.add(commission.amount),
      new Decimal(0)
    );

    const averageCommissionRate = totalVolume.gt(0)
      ? totalCommissions.div(totalVolume)
      : new Decimal(0);

    return {
      totalVolume,
      totalCommissions,
      averageCommissionRate,
      networkSize: networkUsers.length,
    };
  }

  /**
   * Calculate the optimal fee tier for a user based on their trading volume
   *
   * Used for automatically upgrading users to better fee tiers
   */
  public static calculateOptimalFeeTier(
    userVolume: Decimal,
    availableFeeTiers: FeeTier[]
  ): FeeTier {
    const activeTiers = availableFeeTiers
      .filter((tier) => tier.isActive)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const tier of activeTiers) {
      if (userVolume.gte(tier.minimumVolume)) {
        return tier;
      }
    }

    // Return base tier if no other tier qualifies
    return activeTiers.find((tier) => tier.name === 'BASE') || activeTiers[0];
  }

  /**
   * Calculate commission earnings breakdown by time period
   *
   * Used for analytics dashboards and earnings reports
   */
  public static calculateEarningsBreakdown(
    commissions: Commission[],
    startDate?: Date,
    endDate?: Date
  ): {
    totalEarnings: Decimal;
    claimedEarnings: Decimal;
    unclaimedEarnings: Decimal;
    earningsByLevel: Record<number, Decimal>;
    earningsByToken: Record<string, Decimal>;
    earningsByPeriod: { date: string; amount: Decimal }[];
  } {
    // Filter commissions by date range
    let filteredCommissions = commissions;
    if (startDate || endDate) {
      filteredCommissions = commissions.filter((commission) => {
        const commissionDate = commission.createdAt;
        if (startDate && commissionDate < startDate) return false;
        if (endDate && commissionDate > endDate) return false;
        return true;
      });
    }

    const totalEarnings = filteredCommissions.reduce(
      (sum, commission) => sum.add(commission.amount),
      new Decimal(0)
    );

    const claimedEarnings = filteredCommissions
      .filter((commission) => commission.status === 'CLAIMED')
      .reduce((sum, commission) => sum.add(commission.amount), new Decimal(0));

    const unclaimedEarnings = totalEarnings.sub(claimedEarnings);

    // Breakdown by level
    const earningsByLevel: Record<number, Decimal> = {};
    for (let level = 1; level <= 3; level++) {
      earningsByLevel[level] = filteredCommissions
        .filter((commission) => commission.commissionLevel === level)
        .reduce((sum, commission) => sum.add(commission.amount), new Decimal(0));
    }

    // Breakdown by token
    const earningsByToken: Record<string, Decimal> = {};
    filteredCommissions.forEach((commission) => {
      if (!earningsByToken[commission.tokenType]) {
        earningsByToken[commission.tokenType] = new Decimal(0);
      }
      earningsByToken[commission.tokenType] = earningsByToken[commission.tokenType].add(
        commission.amount
      );
    });

    // Breakdown by time period (daily)
    const earningsByPeriod: { date: string; amount: Decimal }[] = [];
    const dailyEarnings = new Map<string, Decimal>();

    filteredCommissions.forEach((commission) => {
      const dateKey = commission.createdAt.toISOString().split('T')[0];
      const current = dailyEarnings.get(dateKey) || new Decimal(0);
      dailyEarnings.set(dateKey, current.add(commission.amount));
    });

    dailyEarnings.forEach((amount, date) => {
      earningsByPeriod.push({ date, amount });
    });

    earningsByPeriod.sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalEarnings,
      claimedEarnings,
      unclaimedEarnings,
      earningsByLevel,
      earningsByToken,
      earningsByPeriod,
    };
  }
}
