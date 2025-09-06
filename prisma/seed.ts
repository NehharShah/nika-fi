import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import bcrypt from 'bcryptjs';
import { feeTierDefinitions, customCommissionStructures } from '../src/config';

/**
 * Database Seed Script
 * 
 * Populates the database with initial data including:
 * - Fee tiers
 * - Sample users with different roles
 * - Sample referral relationships
 * - Sample trades and commissions
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Clean existing data (in development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Cleaning existing data...');
      await prisma.commission.deleteMany();
      await prisma.claim.deleteMany();
      await prisma.trade.deleteMany();
      await prisma.referralNetwork.deleteMany();
      await prisma.user.deleteMany();
      await prisma.feeTier.deleteMany();
    }

    // 1. Create Fee Tiers
    console.log('💰 Creating fee tiers...');
    const feeTiers = await Promise.all(
      feeTierDefinitions.map(tier =>
        prisma.feeTier.create({
          data: {
            name: tier.name,
            minimumVolume: tier.minimumVolume,
            feeRate: tier.feeRate,
            description: tier.description,
            isActive: true,
            priority: tier.priority,
          },
        })
      )
    );
    console.log(`✅ Created ${feeTiers.length} fee tiers`);

    // 2. Create Sample Users
    console.log('👥 Creating sample users...');
    
    const passwordHash = await bcrypt.hash('password123', 12);

    // Team member (admin)
    const teamMember = await prisma.user.create({
      data: {
        email: 'admin@nika.trade',
        username: 'nika_admin',
        passwordHash,
        referralCode: 'NIKAADMN',
        isTeamMember: true,
        feeTier: 'VIP',
      },
    });

    // KOL with 50% commission
    const kol1 = await prisma.user.create({
      data: {
        email: 'kol1@example.com',
        username: 'crypto_kol_1',
        passwordHash,
        referralCode: 'NIKAKOL1',
        customCommissionStructure: customCommissionStructures.KOL_50 as any,
        feeTier: 'TIER3',
        totalTradeVolume: new Decimal(500000),
        totalXpEarned: new Decimal(15000),
      },
    });

    // KOL with custom commission structure
    const kol2 = await prisma.user.create({
      data: {
        email: 'kol2@example.com',
        username: 'crypto_kol_2',
        passwordHash,
        referralCode: 'NIKAKOL2',
        customCommissionStructure: customCommissionStructures.KOL_CUSTOM_HIGH as any,
        feeTier: 'TIER2',
        totalTradeVolume: new Decimal(200000),
        totalXpEarned: new Decimal(8000),
      },
    });

    // Regular users with referral chain
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@example.com',
        username: 'trader_alice',
        passwordHash,
        referralCode: 'NIKA1USR',
        referrerId: kol1.id,
        feeDiscountRate: new Decimal(0.10), // 10% discount
        feeTier: 'TIER1',
        totalTradeVolume: new Decimal(50000),
        totalXpEarned: new Decimal(1500),
      },
    });

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        username: 'trader_bob',
        passwordHash,
        referralCode: 'NIKA2USR',
        referrerId: user1.id,
        feeDiscountRate: new Decimal(0.10),
        feeTier: 'BASE',
        totalTradeVolume: new Decimal(15000),
        totalXpEarned: new Decimal(450),
      },
    });

    const user3 = await prisma.user.create({
      data: {
        email: 'user3@example.com',
        username: 'trader_charlie',
        passwordHash,
        referralCode: 'NIKA3USR',
        referrerId: user2.id,
        feeDiscountRate: new Decimal(0.10),
        feeTier: 'BASE',
        totalTradeVolume: new Decimal(8000),
        totalXpEarned: new Decimal(240),
      },
    });

    // High-volume whale user
    const whale = await prisma.user.create({
      data: {
        email: 'whale@example.com',
        username: 'crypto_whale',
        passwordHash,
        referralCode: 'NIKAWHAL',
        referrerId: kol2.id,
        feeDiscountRate: new Decimal(0.10),
        feeTier: 'VIP',
        totalTradeVolume: new Decimal(2000000),
        totalXpEarned: new Decimal(30000),
      },
    });

    // User with waived fees
    const vipUser = await prisma.user.create({
      data: {
        email: 'vip@nika.trade',
        username: 'nika_vip',
        passwordHash,
        referralCode: 'NIKAVIPS',
        isWaivedFees: true,
        feeTier: 'VIP',
        totalTradeVolume: new Decimal(1000000),
        totalXpEarned: new Decimal(0), // No fees = no XP from fees
      },
    });

    console.log(`✅ Created ${7} sample users with referral relationships`);

    // 3. Create Sample Trades
    console.log('📈 Creating sample trades...');

    const sampleTrades = [
      {
        userId: user1.id,
        baseAsset: 'BTC',
        quoteAsset: 'USDC',
        side: 'BUY',
        volume: new Decimal(1.5),
        price: new Decimal(45000),
        feeRate: new Decimal(0.008), // TIER1 rate
        feeAmount: new Decimal(540),
        netFeeAmount: new Decimal(486), // With 10% discount
        rebateAmount: new Decimal(54),
        chain: 'EVM',
        network: 'Arbitrum',
        status: 'COMPLETED' as any,
        settledAt: new Date(),
      },
      {
        userId: user2.id,
        baseAsset: 'ETH',
        quoteAsset: 'USDC',
        side: 'BUY',
        volume: new Decimal(10),
        price: new Decimal(3000),
        feeRate: new Decimal(0.009), // BASE rate with discount
        feeAmount: new Decimal(300),
        netFeeAmount: new Decimal(270),
        rebateAmount: new Decimal(30),
        chain: 'EVM',
        network: 'Arbitrum',
        status: 'COMPLETED' as any,
        settledAt: new Date(),
      },
      {
        userId: user3.id,
        baseAsset: 'SOL',
        quoteAsset: 'USDC',
        side: 'SELL',
        volume: new Decimal(100),
        price: new Decimal(80),
        feeRate: new Decimal(0.009),
        feeAmount: new Decimal(72),
        netFeeAmount: new Decimal(64.8),
        rebateAmount: new Decimal(7.2),
        chain: 'SVM',
        network: 'Solana',
        status: 'COMPLETED' as any,
        settledAt: new Date(),
      },
      {
        userId: whale.id,
        baseAsset: 'BTC',
        quoteAsset: 'USDC',
        side: 'BUY',
        volume: new Decimal(50),
        price: new Decimal(45000),
        feeRate: new Decimal(0.003), // VIP rate
        feeAmount: new Decimal(6750),
        netFeeAmount: new Decimal(6075), // With 10% discount
        rebateAmount: new Decimal(675),
        chain: 'EVM',
        network: 'Arbitrum',
        status: 'COMPLETED' as any,
        settledAt: new Date(),
      },
    ];

    const trades = await Promise.all(
      sampleTrades.map(trade => prisma.trade.create({ data: trade }))
    );

    console.log(`✅ Created ${trades.length} sample trades`);

    // 4. Create Sample Commissions
    console.log('💸 Creating sample commissions...');

    const sampleCommissions = [
      // Commissions from user1's trade (KOL1 gets 50% commission due to custom structure)
      {
        amount: new Decimal(243), // 50% of 486 USDC net fee (KOL's custom rate)
        tokenType: 'USDC',
        commissionLevel: 1,
        rate: new Decimal(0.50),
        earnerId: kol1.id,
        sourceUserId: user1.id,
        tradeId: trades[0].id,
        originalFeeAmount: new Decimal(540),
        status: 'UNCLAIMED' as any,
      },
      
      // Commissions from user2's trade
      {
        amount: new Decimal(81), // 30% of 270 USDC net fee
        tokenType: 'USDC',
        commissionLevel: 1,
        rate: new Decimal(0.30),
        earnerId: user1.id,
        sourceUserId: user2.id,
        tradeId: trades[1].id,
        originalFeeAmount: new Decimal(300),
        status: 'UNCLAIMED' as any,
      },
      {
        amount: new Decimal(13.5), // 5% of 270 USDC net fee (KOL's custom L2 rate)
        tokenType: 'USDC',
        commissionLevel: 2,
        rate: new Decimal(0.05),
        earnerId: kol1.id,
        sourceUserId: user2.id,
        tradeId: trades[1].id,
        originalFeeAmount: new Decimal(300),
        status: 'UNCLAIMED' as any,
      },

      // Commissions from user3's trade
      {
        amount: new Decimal(19.44), // 30% of 64.8 USDC
        tokenType: 'USDC',
        commissionLevel: 1,
        rate: new Decimal(0.30),
        earnerId: user2.id,
        sourceUserId: user3.id,
        tradeId: trades[2].id,
        originalFeeAmount: new Decimal(72),
        status: 'UNCLAIMED' as any,
      },
      {
        amount: new Decimal(1.944), // 3% of 64.8 USDC
        tokenType: 'USDC',
        commissionLevel: 2,
        rate: new Decimal(0.03),
        earnerId: user1.id,
        sourceUserId: user3.id,
        tradeId: trades[2].id,
        originalFeeAmount: new Decimal(72),
        status: 'UNCLAIMED' as any,
      },
      {
        amount: new Decimal(1.296), // 2% of 64.8 USDC
        tokenType: 'USDC',
        commissionLevel: 3,
        rate: new Decimal(0.02),
        earnerId: kol1.id,
        sourceUserId: user3.id,
        tradeId: trades[2].id,
        originalFeeAmount: new Decimal(72),
        status: 'UNCLAIMED' as any,
      },

      // Commissions from whale's trade
      {
        amount: new Decimal(2430), // 40% of 6075 USDC (KOL2's custom rate)
        tokenType: 'USDC',
        commissionLevel: 1,
        rate: new Decimal(0.40),
        earnerId: kol2.id,
        sourceUserId: whale.id,
        tradeId: trades[3].id,
        originalFeeAmount: new Decimal(6750),
        status: 'CLAIMED' as any,
        claimedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Claimed yesterday
      },
    ];

    const commissions = await Promise.all(
      sampleCommissions.map(commission => prisma.commission.create({ data: commission }))
    );

    console.log(`✅ Created ${commissions.length} sample commissions`);

    // 5. Create Sample Claims
    console.log('🎯 Creating sample claims...');

    const sampleClaim = await prisma.claim.create({
      data: {
        userId: kol2.id,
        totalAmount: new Decimal(2430),
        tokenType: 'USDC',
        transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
        chain: 'EVM',
        network: 'Arbitrum',
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        status: 'COMPLETED' as any,
        processedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      },
    });

    // Update the commission to link to this claim
    await prisma.commission.update({
      where: { id: commissions[commissions.length - 1].id },
      data: { claimId: sampleClaim.id },
    });

    console.log(`✅ Created sample claim`);

    // 6. Create Referral Network Statistics
    console.log('🕸️ Creating referral network statistics...');

    const networkStats = [
      {
        userId: kol1.id,
        level1Count: 1,
        level2Count: 1,
        level3Count: 1,
        totalNetworkSize: 3,
        totalNetworkVolume: new Decimal(73000), // user1 + user2 + user3
        totalCommissionsEarned: new Decimal(257.796), // Sum of KOL1's commissions
      },
      {
        userId: kol2.id,
        level1Count: 1,
        level2Count: 0,
        level3Count: 0,
        totalNetworkSize: 1,
        totalNetworkVolume: new Decimal(2000000), // whale's volume
        totalCommissionsEarned: new Decimal(2430),
      },
      {
        userId: user1.id,
        level1Count: 1,
        level2Count: 1,
        level3Count: 0,
        totalNetworkSize: 2,
        totalNetworkVolume: new Decimal(23000), // user2 + user3
        totalCommissionsEarned: new Decimal(82.944), // Sum of user1's commissions
      },
      {
        userId: user2.id,
        level1Count: 1,
        level2Count: 0,
        level3Count: 0,
        totalNetworkSize: 1,
        totalNetworkVolume: new Decimal(8000), // user3's volume
        totalCommissionsEarned: new Decimal(19.44),
      },
    ];

    await Promise.all(
      networkStats.map(stats => prisma.referralNetwork.create({ data: stats }))
    );

    console.log(`✅ Created ${networkStats.length} referral network records`);

    // 7. Update user XP based on commissions
    console.log('⭐ Updating user XP...');

    const commissionTotals = await prisma.commission.groupBy({
      by: ['earnerId'],
      _sum: { amount: true },
    });

    for (const total of commissionTotals) {
      await prisma.user.update({
        where: { id: total.earnerId },
        data: {
          totalXpEarned: {
            increment: new Decimal(total._sum.amount?.toString() || '0'),
          },
        },
      });
    }

    console.log('✅ Updated user XP based on commissions');

    console.log(`
🎉 Database seed completed successfully!

📊 Summary:
• Fee Tiers: ${feeTiers.length}
• Users: 7 (1 admin, 2 KOLs, 4 regular users)
• Trades: ${trades.length}
• Commissions: ${commissions.length}
• Claims: 1
• Referral Networks: ${networkStats.length}

🧪 Test Users:
• Admin: admin@nika.trade (password: password123)
• KOL 1: kol1@example.com (50% commission)
• KOL 2: kol2@example.com (custom commission)
• User 1: user1@example.com (referred by KOL1)
• User 2: user2@example.com (referred by User1)
• User 3: user3@example.com (referred by User2)
• Whale: whale@example.com (VIP tier)

🔗 Referral Chains:
• KOL1 → User1 → User2 → User3 (3-level chain)
• KOL2 → Whale (1-level chain)

💰 Sample Commission Flow:
• User3 trades → User2 gets 30% → User1 gets 3% → KOL1 gets 2%
• Total commissions distributed: ~$2,790 USDC equivalent
    `);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
