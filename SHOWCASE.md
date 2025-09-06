# Nika Referral System - Take Home Assessment

## ✅ Completed Requirements

### Core Features
- **3-Level Commission Cascade**: 30% → 3% → 2% distribution ✅
- **Dynamic Fee Tiers**: Volume-based optimization ✅
- **Custom Commission Structures**: KOL rates (50%, 40%, etc.) ✅
- **Fee Discount System**: 10% signup discount ✅
- **Multi-Chain Support**: EVM (Arbitrum, Ethereum) + SVM (Solana) ✅
- **Race Condition Safety**: Atomic transactions ✅

### API Endpoints
- `POST /api/referral/register` - User registration with referral codes ✅
- `POST /api/referral/generate` - Generate referral codes ✅
- `GET /api/referral/network/:userId` - View referral network ✅
- `GET /api/referral/earnings/:userId` - Earnings breakdown ✅
- `POST /api/referral/claim` - Claim validation ✅
- `POST /api/webhook/trade` - Trade processing webhook ✅

### Technical Implementation
- **Database**: PostgreSQL with Prisma ORM ✅
- **Authentication**: JWT + API key for webhooks ✅
- **Validation**: Comprehensive input validation ✅
- **Decimal Math**: Accurate financial calculations ✅
- **Error Handling**: Structured error responses ✅
- **Rate Limiting**: User-based protection ✅

## 🧪 Verification Results

### Local Development
```bash
# Registration & Referral Flow
User A registered → referral code: NIKAFU4Z
User B registered with A's code → 10% discount applied
Trade webhook: 25 BTC @ $50k → $1.25M volume
Commission: A earned 3375 USDC (30% of fees)
```

### Docker Production
```bash
# Docker Stack
Health check: ✅ 200 OK
User dockerA → referral code: NIKA063P  
User dockerB → registered with dockerA's code
Trade webhook: 25 BTC @ $50k → SUCCESS
Commission: dockerA earned 3375 USDC
```

## 🔧 Technical Highlights

### Database Schema
- **Users**: Referral codes, fee tiers, custom structures
- **Trades**: Volume tracking, fee calculations
- **Commissions**: Multi-level earnings with status
- **Claims**: Withdrawal management
- **Indexes**: Optimized for performance

### Business Logic
```typescript
// Commission calculation with fee tier priority
if (customFeeRate) use customFeeRate;
else if (tierRate < discountedBase) use tierRate;
else use baseRate with discount;

// 3-level cascade distribution
Level 1: feeAmount × 30%
Level 2: feeAmount × 3%  
Level 3: feeAmount × 2%
```

### Production Features
- **Docker**: Multi-stage builds with health checks
- **CI/CD**: GitHub Actions pipeline
- **Monitoring**: Health endpoints and structured logging
- **Security**: Input sanitization, rate limiting, JWT auth
- **Environment Management**: Dev/test/production configs

## 🚀 Quick Start

```bash
# Local Development
npm install
npx prisma db push && npx prisma db seed
npm run dev

# Docker Production  
docker compose build
docker compose up -d
curl http://localhost:3000/health

# Test Flow
curl -X POST http://localhost:3000/api/referral/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPass1!"}'
```

## 📊 Commission Example

**Scenario**: User D trades $1000 volume with 1% base fee ($10 fee)

```
Chain: A → B → C → D (trader)
Commissions:
- C (Level 1): $10 × 30% = $3.00
- B (Level 2): $10 × 3% = $0.30
- A (Level 3): $10 × 2% = $0.20
```

---

