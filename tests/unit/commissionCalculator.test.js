"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const decimal_js_1 = require("decimal.js");
const commissionCalculator_1 = require("../../src/utils/commissionCalculator");
describe('CommissionCalculator', () => {
    const mockFeeTiers = [
        {
            id: '1',
            name: 'BASE',
            minimumVolume: new decimal_js_1.Decimal(0),
            feeRate: new decimal_js_1.Decimal(0.01),
            priority: 0,
            isActive: true,
            description: 'Base tier',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: '2',
            name: 'TIER1',
            minimumVolume: new decimal_js_1.Decimal(10000),
            feeRate: new decimal_js_1.Decimal(0.008),
            priority: 1,
            isActive: true,
            description: 'Bronze tier',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: '3',
            name: 'VIP',
            minimumVolume: new decimal_js_1.Decimal(1000000),
            feeRate: new decimal_js_1.Decimal(0.003),
            priority: 4,
            isActive: true,
            description: 'VIP tier',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];
    const createMockUser = (overrides = {}) => ({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        referralCode: 'NIKATEST',
        referrerId: undefined,
        feeTier: 'BASE',
        customFeeRate: undefined,
        feeDiscountRate: new decimal_js_1.Decimal(0),
        customCommissionStructure: undefined,
        isTeamMember: false,
        isWaivedFees: false,
        totalXpEarned: new decimal_js_1.Decimal(0),
        totalTradeVolume: new decimal_js_1.Decimal(0),
        totalFeesPaid: new decimal_js_1.Decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
        ...overrides,
    });
    describe('calculateEffectiveFeeRate', () => {
        it('should apply base fee rate for new users with no discount', () => {
            const user = createMockUser();
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
            expect(result.originalFeeRate.toString()).toBe('0.01');
            expect(result.appliedFeeRate.toString()).toBe('0.01');
            expect(result.feeAmount.toString()).toBe('10');
            expect(result.netFeeAmount.toString()).toBe('10');
            expect(result.rebateAmount.toString()).toBe('0');
            expect(result.discountApplied).toBe(false);
            expect(result.tierUsed).toBe('BASE');
        });
        it('should apply fee discount for referred users', () => {
            const user = createMockUser({
                feeDiscountRate: new decimal_js_1.Decimal(0.10),
            });
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
            expect(result.appliedFeeRate.toString()).toBe('0.009');
            expect(result.feeAmount.toString()).toBe('10');
            expect(result.netFeeAmount.toString()).toBe('9');
            expect(result.rebateAmount.toString()).toBe('1');
            expect(result.discountApplied).toBe(true);
            expect(result.tierUsed).toBe('BASE');
        });
        it('should use fee tier rate when better than discounted base rate', () => {
            const user = createMockUser({
                feeDiscountRate: new decimal_js_1.Decimal(0.10),
                totalTradeVolume: new decimal_js_1.Decimal(15000),
            });
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
            expect(result.appliedFeeRate.toString()).toBe('0.008');
            expect(result.feeAmount.toString()).toBe('10');
            expect(result.netFeeAmount.toString()).toBe('8');
            expect(result.rebateAmount.toString()).toBe('2');
            expect(result.discountApplied).toBe(false);
            expect(result.tierUsed).toBe('TIER1');
        });
        it('should use custom fee rate when specified', () => {
            const user = createMockUser({
                customFeeRate: new decimal_js_1.Decimal(0.005),
            });
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
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
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
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
            const tradeVolume = new decimal_js_1.Decimal(1000);
            const result = commissionCalculator_1.CommissionCalculator.calculateEffectiveFeeRate(user, tradeVolume, mockFeeTiers);
            expect(result.appliedFeeRate.toString()).toBe('0');
            expect(result.tierUsed).toBe('WAIVED');
        });
    });
    describe('calculateCommissionDistribution', () => {
        const mockTrade = {
            id: 'trade-1',
            userId: 'user-1',
            tradeType: 'SPOT',
            baseAsset: 'BTC',
            quoteAsset: 'USDC',
            side: 'BUY',
            volume: new decimal_js_1.Decimal(1),
            price: new decimal_js_1.Decimal(50000),
            feeRate: new decimal_js_1.Decimal(0.01),
            feeAmount: new decimal_js_1.Decimal(500),
            netFeeAmount: new decimal_js_1.Decimal(450),
            rebateAmount: new decimal_js_1.Decimal(50),
            chain: 'EVM',
            network: 'Arbitrum',
            status: 'COMPLETED',
            settledAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const feeCalculationResult = {
            originalFeeRate: new decimal_js_1.Decimal(0.01),
            appliedFeeRate: new decimal_js_1.Decimal(0.009),
            feeAmount: new decimal_js_1.Decimal(500),
            netFeeAmount: new decimal_js_1.Decimal(450),
            rebateAmount: new decimal_js_1.Decimal(50),
            discountApplied: true,
            tierUsed: 'BASE',
        };
        it('should calculate standard 3-level commission distribution', async () => {
            const trader = createMockUser({ id: 'trader' });
            const level1 = createMockUser({ id: 'level1', email: 'level1@test.com' });
            const level2 = createMockUser({ id: 'level2', email: 'level2@test.com' });
            const level3 = createMockUser({ id: 'level3', email: 'level3@test.com' });
            const referralChain = [level1, level2, level3];
            const result = await commissionCalculator_1.CommissionCalculator.calculateCommissionDistribution(mockTrade, trader, referralChain, feeCalculationResult);
            expect(result).toHaveLength(3);
            expect(result[0].level).toBe(1);
            expect(result[0].earnerId).toBe('level1');
            expect(result[0].amount.toString()).toBe('135');
            expect(result[0].rate.toString()).toBe('0.30');
            expect(result[1].level).toBe(2);
            expect(result[1].earnerId).toBe('level2');
            expect(result[1].amount.toString()).toBe('13.5');
            expect(result[1].rate.toString()).toBe('0.03');
            expect(result[2].level).toBe(3);
            expect(result[2].earnerId).toBe('level3');
            expect(result[2].amount.toString()).toBe('9');
            expect(result[2].rate.toString()).toBe('0.02');
        });
        it('should use custom commission structure for KOLs', async () => {
            const trader = createMockUser({ id: 'trader' });
            const kolCustomStructure = {
                level1Rate: 0.50,
                level2Rate: 0.05,
                level3Rate: 0.03,
                type: 'KOL_50',
            };
            const kol = createMockUser({
                id: 'kol',
                email: 'kol@test.com',
                customCommissionStructure: kolCustomStructure,
            });
            const level2 = createMockUser({ id: 'level2', email: 'level2@test.com' });
            const referralChain = [kol, level2];
            const result = await commissionCalculator_1.CommissionCalculator.calculateCommissionDistribution(mockTrade, trader, referralChain, feeCalculationResult);
            expect(result).toHaveLength(2);
            expect(result[0].amount.toString()).toBe('225');
            expect(result[0].rate.toString()).toBe('0.50');
            expect(result[1].amount.toString()).toBe('13.5');
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
            const result = await commissionCalculator_1.CommissionCalculator.calculateCommissionDistribution(mockTrade, trader, referralChain, feeCalculationResult);
            expect(result).toHaveLength(1);
            expect(result[0].earnerId).toBe('level2');
            expect(result[0].level).toBe(2);
        });
        it('should return empty array when net fee is zero', async () => {
            const trader = createMockUser({ id: 'trader' });
            const referrer = createMockUser({ id: 'referrer' });
            const referralChain = [referrer];
            const zeroFeeResult = {
                ...feeCalculationResult,
                netFeeAmount: new decimal_js_1.Decimal(0),
            };
            const result = await commissionCalculator_1.CommissionCalculator.calculateCommissionDistribution(mockTrade, trader, referralChain, zeroFeeResult);
            expect(result).toHaveLength(0);
        });
    });
    describe('validateReferralChain', () => {
        it('should validate a valid referral chain', () => {
            const user1 = createMockUser({ id: 'user1' });
            const user2 = createMockUser({ id: 'user2' });
            const user3 = createMockUser({ id: 'user3' });
            const result = commissionCalculator_1.CommissionCalculator.validateReferralChain('newuser', [user1, user2, user3]);
            expect(result).toBe(true);
        });
        it('should reject circular references', () => {
            const user1 = createMockUser({ id: 'user1' });
            const user2 = createMockUser({ id: 'user2' });
            const result = commissionCalculator_1.CommissionCalculator.validateReferralChain('user1', [user1, user2]);
            expect(result).toBe(false);
        });
        it('should reject chains exceeding maximum depth', () => {
            const user1 = createMockUser({ id: 'user1' });
            const user2 = createMockUser({ id: 'user2' });
            const user3 = createMockUser({ id: 'user3' });
            const user4 = createMockUser({ id: 'user4' });
            const result = commissionCalculator_1.CommissionCalculator.validateReferralChain('newuser', [user1, user2, user3, user4]);
            expect(result).toBe(false);
        });
        it('should reject chains with duplicate users', () => {
            const user1 = createMockUser({ id: 'user1' });
            const user2 = createMockUser({ id: 'user2' });
            const result = commissionCalculator_1.CommissionCalculator.validateReferralChain('newuser', [user1, user2, user1]);
            expect(result).toBe(false);
        });
    });
    describe('calculateOptimalFeeTier', () => {
        it('should return highest tier user qualifies for', () => {
            const userVolume = new decimal_js_1.Decimal(1500000);
            const result = commissionCalculator_1.CommissionCalculator.calculateOptimalFeeTier(userVolume, mockFeeTiers);
            expect(result.name).toBe('VIP');
            expect(result.feeRate.toString()).toBe('0.003');
        });
        it('should return base tier for low volume users', () => {
            const userVolume = new decimal_js_1.Decimal(5000);
            const result = commissionCalculator_1.CommissionCalculator.calculateOptimalFeeTier(userVolume, mockFeeTiers);
            expect(result.name).toBe('BASE');
            expect(result.feeRate.toString()).toBe('0.01');
        });
        it('should return intermediate tier when qualified', () => {
            const userVolume = new decimal_js_1.Decimal(50000);
            const result = commissionCalculator_1.CommissionCalculator.calculateOptimalFeeTier(userVolume, mockFeeTiers);
            expect(result.name).toBe('TIER1');
            expect(result.feeRate.toString()).toBe('0.008');
        });
    });
});
//# sourceMappingURL=commissionCalculator.test.js.map