"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const client_1 = require("@prisma/client");
const server_1 = __importDefault(require("../../src/server"));
const auth_1 = require("../../src/middleware/auth");
describe('Referral API Integration Tests', () => {
    let app;
    let prisma;
    let server;
    let testUsers = {};
    let testTokens = {};
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/nika_referral_test';
        server = new server_1.default();
        app = server.getApp();
        prisma = new client_1.PrismaClient();
        await prisma.$connect();
        await cleanDatabase();
    });
    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });
    beforeEach(async () => {
        await cleanDatabase();
        await seedTestData();
    });
    async function cleanDatabase() {
        await prisma.commission.deleteMany();
        await prisma.claim.deleteMany();
        await prisma.trade.deleteMany();
        await prisma.referralNetwork.deleteMany();
        await prisma.user.deleteMany();
        await prisma.feeTier.deleteMany();
    }
    async function seedTestData() {
        await prisma.feeTier.createMany({
            data: [
                {
                    name: 'BASE',
                    minimumVolume: 0,
                    feeRate: 0.01,
                    priority: 0,
                    isActive: true,
                    description: 'Base tier',
                },
                {
                    name: 'TIER1',
                    minimumVolume: 10000,
                    feeRate: 0.008,
                    priority: 1,
                    isActive: true,
                    description: 'Bronze tier',
                },
            ],
        });
        const user1 = await prisma.user.create({
            data: {
                email: 'user1@test.com',
                username: 'testuser1',
                passwordHash: 'hashed_password',
                referralCode: 'NIKATEST',
                feeTier: 'BASE',
                totalTradeVolume: 0,
                totalXpEarned: 0,
                totalFeesPaid: 0,
            },
        });
        const user2 = await prisma.user.create({
            data: {
                email: 'user2@test.com',
                username: 'testuser2',
                passwordHash: 'hashed_password',
                referralCode: 'NIKATST2',
                referrerId: user1.id,
                feeDiscountRate: 0.10,
                feeTier: 'BASE',
                totalTradeVolume: 0,
                totalXpEarned: 0,
                totalFeesPaid: 0,
            },
        });
        testUsers = { user1, user2 };
        testTokens = {
            user1: (0, auth_1.generateTestToken)(user1.id, user1.email),
            user2: (0, auth_1.generateTestToken)(user2.id, user2.email),
        };
    }
    describe('POST /api/referral/register', () => {
        it('should register a new user without referral code', async () => {
            const userData = {
                email: 'newuser@test.com',
                username: 'newuser',
                password: 'password123',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send(userData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(userData.email);
            expect(response.body.data.user.referralCode).toMatch(/^NIKA[A-Z0-9]{4}$/);
            expect(response.body.data.user.feeDiscountRate).toBe(0);
            expect(response.body.data.token).toBeDefined();
        });
        it('should register a new user with valid referral code', async () => {
            const userData = {
                email: 'referred@test.com',
                username: 'referreduser',
                password: 'password123',
                referralCode: 'NIKATEST',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send(userData)
                .expect(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.referrerId).toBe(testUsers.user1.id);
            expect(response.body.data.user.feeDiscountRate).toBe(0.1);
        });
        it('should reject registration with invalid referral code', async () => {
            const userData = {
                email: 'invalid@test.com',
                username: 'invaliduser',
                password: 'password123',
                referralCode: 'INVALID1',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send(userData)
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('REFERRAL_CODE_NOT_FOUND');
        });
        it('should reject registration with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                username: 'testuser',
                password: 'password123',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send(userData)
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('VALIDATION_ERROR');
        });
        it('should reject registration with duplicate email', async () => {
            const userData = {
                email: 'user1@test.com',
                username: 'duplicate',
                password: 'password123',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send(userData)
                .expect(409);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('EMAIL_EXISTS');
        });
    });
    describe('POST /api/referral/generate', () => {
        it('should generate referral code for authenticated user', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/generate')
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .send({ userId: testUsers.user1.id })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.referralCode).toBe('NIKATEST');
            expect(response.body.data.referralUrl).toContain('ref=NIKATEST');
        });
        it('should reject unauthenticated requests', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/generate')
                .send({ userId: testUsers.user1.id })
                .expect(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('UNAUTHORIZED');
        });
        it('should reject requests for other users', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/generate')
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .send({ userId: testUsers.user2.id })
                .expect(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('FORBIDDEN');
        });
    });
    describe('GET /api/referral/network/:userId', () => {
        it('should return user referral network', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/referral/network/${testUsers.user1.id}`)
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.id).toBe(testUsers.user1.id);
            expect(response.body.data.user.level).toBe(1);
            expect(response.body.data.children).toHaveLength(1);
            expect(response.body.data.children[0].user.id).toBe(testUsers.user2.id);
        });
        it('should support pagination', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/referral/network/${testUsers.user1.id}`)
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .query({ page: 1, limit: 10 })
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });
    describe('GET /api/referral/earnings/:userId', () => {
        beforeEach(async () => {
            const trade = await prisma.trade.create({
                data: {
                    userId: testUsers.user2.id,
                    tradeType: 'SPOT',
                    baseAsset: 'BTC',
                    quoteAsset: 'USDC',
                    side: 'BUY',
                    volume: 1,
                    price: 50000,
                    feeRate: 0.009,
                    feeAmount: 500,
                    netFeeAmount: 450,
                    rebateAmount: 50,
                    chain: 'EVM',
                    network: 'Arbitrum',
                    status: 'COMPLETED',
                    settledAt: new Date(),
                },
            });
            await prisma.commission.create({
                data: {
                    amount: 135,
                    tokenType: 'USDC',
                    commissionLevel: 1,
                    rate: 0.30,
                    earnerId: testUsers.user1.id,
                    sourceUserId: testUsers.user2.id,
                    tradeId: trade.id,
                    originalFeeAmount: 500,
                    status: 'UNCLAIMED',
                },
            });
        });
        it('should return earnings breakdown for user', async () => {
            const response = await (0, supertest_1.default)(app)
                .get(`/api/referral/earnings/${testUsers.user1.id}`)
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.totalEarnings.unclaimed).toBe('135');
            expect(response.body.data.totalEarnings.claimed).toBe('0');
            expect(response.body.data.totalEarnings.total).toBe('135');
            expect(response.body.data.earningsByLevel.level1).toBe('135');
        });
        it('should support date range filtering', async () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const response = await (0, supertest_1.default)(app)
                .get(`/api/referral/earnings/${testUsers.user1.id}`)
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .query({
                startDate: yesterday.toISOString(),
                endDate: tomorrow.toISOString(),
            })
                .expect(200);
            expect(response.body.success).toBe(true);
        });
    });
    describe('POST /api/referral/claim', () => {
        beforeEach(async () => {
            await prisma.commission.create({
                data: {
                    amount: 100,
                    tokenType: 'USDC',
                    commissionLevel: 1,
                    rate: 0.30,
                    earnerId: testUsers.user1.id,
                    sourceUserId: testUsers.user2.id,
                    tradeId: 'fake-trade-id',
                    originalFeeAmount: 333,
                    status: 'UNCLAIMED',
                },
            });
        });
        it('should validate claimable amount', async () => {
            const claimData = {
                userId: testUsers.user1.id,
                tokenType: 'USDC',
                walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/claim')
                .set('Authorization', `Bearer ${testTokens.user1}`)
                .send(claimData)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.claimableAmount).toBe('100');
            expect(response.body.data.tokenType).toBe('USDC');
        });
        it('should reject claim with insufficient balance', async () => {
            const claimData = {
                userId: testUsers.user2.id,
                tokenType: 'USDC',
                walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/claim')
                .set('Authorization', `Bearer ${testTokens.user2}`)
                .send(claimData)
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('INVALID_CLAIM_REQUEST');
        });
    });
    describe('POST /api/webhook/trade', () => {
        it('should process trade and distribute commissions', async () => {
            const tradeData = {
                userId: testUsers.user2.id,
                tradeType: 'SPOT',
                baseAsset: 'BTC',
                quoteAsset: 'USDC',
                side: 'BUY',
                volume: '1.0',
                price: '50000',
                chain: 'EVM',
                network: 'Arbitrum',
                transactionHash: '0xabcdef123456',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/webhook/trade')
                .set('X-API-Key', process.env.WEBHOOK_API_KEY || 'nika-webhook-secret-key')
                .send(tradeData)
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.tradeId).toBeDefined();
            expect(response.body.data.status).toBe('SUCCESS');
            expect(response.body.data.commissionsDistributed).toHaveLength(1);
            const commission = response.body.data.commissionsDistributed[0];
            expect(commission.earnerId).toBe(testUsers.user1.id);
            expect(commission.level).toBe(1);
            expect(parseFloat(commission.amount)).toBeGreaterThan(0);
        });
        it('should reject webhook without API key', async () => {
            const tradeData = {
                userId: testUsers.user2.id,
                tradeType: 'SPOT',
                baseAsset: 'BTC',
                quoteAsset: 'USDC',
                side: 'BUY',
                volume: '1.0',
                price: '50000',
                chain: 'EVM',
                network: 'Arbitrum',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/webhook/trade')
                .send(tradeData)
                .expect(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('INVALID_API_KEY');
        });
        it('should validate network-chain combination', async () => {
            const tradeData = {
                userId: testUsers.user2.id,
                tradeType: 'SPOT',
                baseAsset: 'BTC',
                quoteAsset: 'USDC',
                side: 'BUY',
                volume: '1.0',
                price: '50000',
                chain: 'EVM',
                network: 'Solana',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/webhook/trade')
                .set('X-API-Key', process.env.WEBHOOK_API_KEY || 'nika-webhook-secret-key')
                .send(tradeData)
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('INVALID_NETWORK_CHAIN_COMBINATION');
        });
    });
    describe('GET /api/referral/validate-code/:code', () => {
        it('should validate existing referral code', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/referral/validate-code/NIKATEST')
                .expect(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.code).toBe('NIKATEST');
            expect(response.body.data.isValid).toBe(true);
        });
        it('should reject invalid referral code format', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/referral/validate-code/INVALID')
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('VALIDATION_ERROR');
        });
    });
    describe('Error Handling', () => {
        it('should handle 404 for non-existent routes', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/nonexistent')
                .expect(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('NOT_FOUND');
        });
        it('should handle malformed JSON', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/referral/register')
                .send('invalid json')
                .expect(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('INVALID_JSON');
        });
    });
});
//# sourceMappingURL=referral.test.js.map