import { Decimal } from 'decimal.js';
import { CommissionCalculator } from '../../src/utils/commissionCalculator';
import { User, FeeTier, Trade, CustomCommissionStructure } from '../../src/types';

/**
 * Unit Tests for Commission Calculator
 * 
 * Tests the core business logic including:
 * - Fee tier calculations with discounts
 * - Multi-level commission distribution
 * - Custom commission structures for KOLs
 * - Edge cases and validation
 */

describe('CommissionCalculator', () => {
  // Mock data
  const mockFeeTiers: FeeTier[] = [
    {
      id: '1',
      name: 'BASE',
      minimumVolume: new Decimal(0),
      feeRate: new Decimal(0.01), // 1%
      priority: 0,
      isActive: true,
      description: 'Base tier',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'TIER1',
      minimumVolume: new Decimal(10000),
      feeRate: new Decimal(0.008), // 0.8%
      priority: 1,
      isActive: true,
      description: 'Bronze tier',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      name: 'VIP',
      minimumVolume: new Decimal(1000000),
      feeRate: new Decimal(0.003), // 0.3%
      priority: 4,
      isActive: true,
      description: 'VIP tier',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    referralCode: 'NIKATEST',
    referrerId: undefined,
    feeTier: 'BASE',
    customFeeRate: undefined,
    feeDiscountRate: new Decimal(0),
    customCommissionStructure: undefined,
    isTeamMember: false,
    isWaivedFees: false,
    totalXpEarned: new Decimal(0),
    totalTradeVolume: new Decimal(0),
    totalFeesPaid: new Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
    ...overrides,
  });

  describe('calculateEffectiveFeeRate', () => {
    it('should apply base fee rate for new users with no discount', () => {
      const user = createMockUser();
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.originalFeeRate.toString()).toBe('0.01');
      expect(result.appliedFeeRate.toString()).toBe('0.01');
      expect(result.feeAmount.toString()).toBe('10'); // 1000 * 0.01
      expect(result.netFeeAmount.toString()).toBe('10');
      expect(result.rebateAmount.toString()).toBe('0');
      expect(result.discountApplied).toBe(false);
      expect(result.tierUsed).toBe('BASE');
    });

    it('should apply fee discount for referred users', () => {
      const user = createMockUser({
        feeDiscountRate: new Decimal(0.10), // 10% discount
      });
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.appliedFeeRate.toString()).toBe('0.009'); // 1% - 10% = 0.9%
      expect(result.feeAmount.toString()).toBe('10'); // Always charge base rate initially
      expect(result.netFeeAmount.toString()).toBe('9'); // After discount
      expect(result.rebateAmount.toString()).toBe('1'); // Difference
      expect(result.discountApplied).toBe(true);
      expect(result.tierUsed).toBe('BASE');
    });

    it('should use fee tier rate when better than discounted base rate', () => {
      const user = createMockUser({
        feeDiscountRate: new Decimal(0.10),
        totalTradeVolume: new Decimal(15000), // Qualifies for TIER1
      });
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.appliedFeeRate.toString()).toBe('0.008'); // TIER1 rate is better than 0.9%
      expect(result.feeAmount.toString()).toBe('10');
      expect(result.netFeeAmount.toString()).toBe('8');
      expect(result.rebateAmount.toString()).toBe('2');
      expect(result.discountApplied).toBe(false); // Tier used instead of discount
      expect(result.tierUsed).toBe('TIER1');
    });

    it('should use custom fee rate when specified', () => {
      const user = createMockUser({
        customFeeRate: new Decimal(0.005), // 0.5% custom rate
      });
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.appliedFeeRate.toString()).toBe('0.005');
      expect(result.feeAmount.toString()).toBe('5');
      expect(result.netFeeAmount.toString()).toBe('5');
      expect(result.rebateAmount.toString()).toBe('0');
      expect(result.tierUsed).toBe('CUSTOM');
    });

    it('should waive fees for team members', () => {
      const user = createMockUser({
        isTeamMember: true,
      });
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.appliedFeeRate.toString()).toBe('0');
      expect(result.feeAmount.toString()).toBe('0');
      expect(result.netFeeAmount.toString()).toBe('0');
      expect(result.rebateAmount.toString()).toBe('0');
      expect(result.tierUsed).toBe('WAIVED');
    });

    it('should waive fees for users with waived fees flag', () => {
      const user = createMockUser({
        isWaivedFees: true,
      });
      const tradeVolume = new Decimal(1000);

      const result = CommissionCalculator.calculateEffectiveFeeRate(
        user,
        tradeVolume,
        mockFeeTiers
      );

      expect(result.appliedFeeRate.toString()).toBe('0');
      expect(result.tierUsed).toBe('WAIVED');
    });
  });

  describe('calculateCommissionDistribution', () => {
    const mockTrade: Trade = {
      id: 'trade-1',
      userId: 'user-1',
      tradeType: 'SPOT',
      baseAsset: 'BTC',
      quoteAsset: 'USDC',
      side: 'BUY',
      volume: new Decimal(1),
      price: new Decimal(50000),
      feeRate: new Decimal(0.01),
      feeAmount: new Decimal(500),
      netFeeAmount: new Decimal(450),
      rebateAmount: new Decimal(50),
      chain: 'EVM',
      network: 'Arbitrum',
      status: 'COMPLETED',
      settledAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const feeCalculationResult = {
      originalFeeRate: new Decimal(0.01),
      appliedFeeRate: new Decimal(0.009),
      feeAmount: new Decimal(500),
      netFeeAmount: new Decimal(450),
      rebateAmount: new Decimal(50),
      discountApplied: true,
      tierUsed: 'BASE',
    };

    it('should calculate standard 3-level commission distribution', async () => {
      const trader = createMockUser({ id: 'trader' });
      const level1 = createMockUser({ id: 'level1', email: 'level1@test.com' });
      const level2 = createMockUser({ id: 'level2', email: 'level2@test.com' });
      const level3 = createMockUser({ id: 'level3', email: 'level3@test.com' });

      const referralChain = [level1, level2, level3];

      const result = await CommissionCalculator.calculateCommissionDistribution(
        mockTrade,
        trader,
        referralChain,
        feeCalculationResult
      );

      expect(result).toHaveLength(3);

      // Level 1: 30% of 450 = 135 USDC
      expect(result[0].level).toBe(1);
      expect(result[0].earnerId).toBe('level1');
      expect(result[0].amount.toString()).toBe('135');
      expect(result[0].rate.toString()).toBe('0.30');

      // Level 2: 3% of 450 = 13.5 USDC
      expect(result[1].level).toBe(2);
      expect(result[1].earnerId).toBe('level2');
      expect(result[1].amount.toString()).toBe('13.5');
      expect(result[1].rate.toString()).toBe('0.03');

      // Level 3: 2% of 450 = 9 USDC
      expect(result[2].level).toBe(3);
      expect(result[2].earnerId).toBe('level3');
      expect(result[2].amount.toString()).toBe('9');
      expect(result[2].rate.toString()).toBe('0.02');
    });

    it('should use custom commission structure for KOLs', async () => {
      const trader = createMockUser({ id: 'trader' });
      const kolCustomStructure: CustomCommissionStructure = {
        level1Rate: 0.50, // 50% instead of 30%
        level2Rate: 0.05, // 5% instead of 3%
        level3Rate: 0.03, // 3% instead of 2%
        type: 'KOL_50',
      };
      
      const kol = createMockUser({ 
        id: 'kol', 
        email: 'kol@test.com',
        customCommissionStructure: kolCustomStructure,
      });
      const level2 = createMockUser({ id: 'level2', email: 'level2@test.com' });

      const referralChain = [kol, level2];

      const result = await CommissionCalculator.calculateCommissionDistribution(
        mockTrade,
        trader,
        referralChain,
        feeCalculationResult
      );

      expect(result).toHaveLength(2);

      // KOL gets 50% instead of 30%
      expect(result[0].amount.toString()).toBe('225'); // 450 * 0.50
      expect(result[0].rate.toString()).toBe('0.50');

      // Level 2 gets 3% (standard rate since no custom structure)
      expect(result[1].amount.toString()).toBe('13.5'); // 450 * 0.03
      expect(result[1].rate.toString()).toBe('0.03');
    });

    it('should skip team members in commission distribution', async () => {
      const trader = createMockUser({ id: 'trader' });
      const teamMember = createMockUser({ 
        id: 'team', 
        email: 'team@test.com',
        isTeamMember: true,
      });
      const level2 = createMockUser({ id: 'level2', email: 'level2@test.com' });

      const referralChain = [teamMember, level2];

      const result = await CommissionCalculator.calculateCommissionDistribution(
        mockTrade,
        trader,
        referralChain,
        feeCalculationResult
      );

      // Should only have level2, team member is skipped
      expect(result).toHaveLength(1);
      expect(result[0].earnerId).toBe('level2');
      expect(result[0].level).toBe(2); // Level shifts up since team member is skipped
    });

    it('should return empty array when net fee is zero', async () => {
      const trader = createMockUser({ id: 'trader' });
      const referrer = createMockUser({ id: 'referrer' });
      const referralChain = [referrer];

      const zeroFeeResult = {
        ...feeCalculationResult,
        netFeeAmount: new Decimal(0),
      };

      const result = await CommissionCalculator.calculateCommissionDistribution(
        mockTrade,
        trader,
        referralChain,
        zeroFeeResult
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('validateReferralChain', () => {
    it('should validate a valid referral chain', () => {
      const user1 = createMockUser({ id: 'user1' });
      const user2 = createMockUser({ id: 'user2' });
      const user3 = createMockUser({ id: 'user3' });

      const result = CommissionCalculator.validateReferralChain(
        'newuser',
        [user1, user2, user3]
      );

      expect(result).toBe(true);
    });

    it('should reject circular references', () => {
      const user1 = createMockUser({ id: 'user1' });
      const user2 = createMockUser({ id: 'user2' });

      const result = CommissionCalculator.validateReferralChain(
        'user1', // User trying to be referred by someone in their own chain
        [user1, user2]
      );

      expect(result).toBe(false);
    });

    it('should reject chains exceeding maximum depth', () => {
      const user1 = createMockUser({ id: 'user1' });
      const user2 = createMockUser({ id: 'user2' });
      const user3 = createMockUser({ id: 'user3' });
      const user4 = createMockUser({ id: 'user4' });

      const result = CommissionCalculator.validateReferralChain(
        'newuser',
        [user1, user2, user3, user4] // 4 levels, exceeds max of 3
      );

      expect(result).toBe(false);
    });

    it('should reject chains with duplicate users', () => {
      const user1 = createMockUser({ id: 'user1' });
      const user2 = createMockUser({ id: 'user2' });

      const result = CommissionCalculator.validateReferralChain(
        'newuser',
        [user1, user2, user1] // user1 appears twice
      );

      expect(result).toBe(false);
    });
  });

  describe('calculateOptimalFeeTier', () => {
    it('should return highest tier user qualifies for', () => {
      const userVolume = new Decimal(1500000); // Qualifies for VIP

      const result = CommissionCalculator.calculateOptimalFeeTier(
        userVolume,
        mockFeeTiers
      );

      expect(result.name).toBe('VIP');
      expect(result.feeRate.toString()).toBe('0.003');
    });

    it('should return base tier for low volume users', () => {
      const userVolume = new Decimal(5000); // Only qualifies for BASE

      const result = CommissionCalculator.calculateOptimalFeeTier(
        userVolume,
        mockFeeTiers
      );

      expect(result.name).toBe('BASE');
      expect(result.feeRate.toString()).toBe('0.01');
    });

    it('should return intermediate tier when qualified', () => {
      const userVolume = new Decimal(50000); // Qualifies for TIER1 but not VIP

      const result = CommissionCalculator.calculateOptimalFeeTier(
        userVolume,
        mockFeeTiers
      );

      expect(result.name).toBe('TIER1');
      expect(result.feeRate.toString()).toBe('0.008');
    });
  });
});
