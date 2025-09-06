# Nika Referral System

A sophisticated commission-based referral system backend for Nika's trading platform, implementing complex business logic for fee calculation and multi-level commission distribution.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone and setup
git clone <repository>
cd nika-take-home

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with your database credentials

# Database setup
npx prisma generate
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

The server will start on `http://localhost:3000`

### Quick API Test

```bash
# Health check
curl http://localhost:3000/health

# API documentation
curl http://localhost:3000/api/docs

# Register a user
curl -X POST http://localhost:3000/api/referral/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","referralCode":"NIKATEST"}'
```

## 📋 Overview

This referral system implements a 3-level cascade commission structure where users earn percentages of trading fees from their referred users' trading activity. The system handles complex business rules including fee tiers, discounts, and custom commission structures for different user types.

### Key Features

- **3-Level Commission Cascade**: 30% → 3% → 2% commission distribution
- **Dynamic Fee Tiers**: Volume-based fee optimization
- **Custom Commission Structures**: Special rates for KOLs and partners
- **Fee Discount System**: Signup bonuses with tier priority logic
- **Multi-Chain Support**: EVM (Arbitrum, Ethereum) and SVM (Solana)
- **Race Condition Safe**: Transaction-based commission distribution
- **Production Ready**: Comprehensive error handling, validation, and logging

## 🏗️ Architecture

### System Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Trading UI    │    │   Admin Panel   │    │  External APIs  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express API Server                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Referral   │ │    Auth     │ │ Validation  │ │   Error   │ │
│  │ Controller  │ │ Middleware  │ │ Middleware  │ │ Handling  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────▼──────────────┐
          │   Referral Service       │
          │  (Business Logic Core)   │
          └───────────┬──────────────┘
                      │
          ┌───────────▼──────────────┐
          │   Commission Calculator  │
          │   (Fee & Rate Engine)    │
          └───────────┬──────────────┘
                      │
          ┌───────────▼──────────────┐
          │   Database Service       │
          │   (Prisma ORM Layer)     │
          └───────────┬──────────────┘
                      │
          ┌───────────▼──────────────┐
          │    PostgreSQL Database   │
          └──────────────────────────┘
```

### Database Schema

![Database Schema](docs/schema-diagram.png)

**Core Entities:**
- **Users**: Referral codes, fee tiers, commission structures
- **Trades**: Volume, fees, commission sources
- **Commissions**: Multi-level earnings tracking
- **Claims**: Crypto withdrawal management
- **Fee Tiers**: Dynamic rate optimization

## 🎯 Business Logic

### Commission Structure

The system implements a sophisticated 3-level cascade:

```
Trader → Direct Referrer (30%) → Level 2 (3%) → Level 3 (2%)
```

**Example:**
- User A refers User B, who refers User C, who refers User D
- When User D trades $1000 with 1% fee ($10):
  - User C earns: $10 × 30% = $3.00
  - User B earns: $10 × 3% = $0.30  
  - User A earns: $10 × 2% = $0.20

### Fee Calculation Priority

The system applies fees in this priority order:

1. **Custom Fee Rate** (for special users)
2. **Fee Tier Rate** (if better than discounted base rate)
3. **Base Rate with Signup Discount**

**Example:**
```
Base Rate: 1.0%
Signup Discount: 10% → Effective: 0.9%
Tier 1 Rate: 0.8% → Used (better than 0.9%)
VIP Rate: 0.3% → Used (best available)
```

### Custom Commission Structures

**KOL 50% Structure:**
```json
{
  "level1Rate": 0.50,  // 50% instead of 30%
  "level2Rate": 0.03,  // Standard 3%
  "level3Rate": 0.02,  // Standard 2%
  "type": "KOL_50"
}
```

**Custom Multi-Level:**
```json
{
  "level1Rate": 0.40,  // 40%
  "level2Rate": 0.05,  // 5%
  "level3Rate": 0.03,  // 3%
  "type": "KOL_CUSTOM"
}
```

## 🔌 API Reference

### Authentication

All authenticated endpoints require a JWT token:

```bash
Authorization: Bearer <jwt_token>
```

### Endpoints

#### User Registration
```http
POST /api/referral/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "trader_alice",
  "password": "password123",
  "referralCode": "NIKATEST"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "referralCode": "NIKA1A2B",
      "feeDiscountRate": 0.1
    },
    "token": "jwt_token"
  }
}
```

#### Generate Referral Code
```http
POST /api/referral/generate
Authorization: Bearer <token>

{
  "userId": "user_uuid"
}
```

#### Get Referral Network
```http
GET /api/referral/network/{userId}?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "referrer@example.com",
      "level": 1,
      "totalVolume": "150000.00",
      "totalCommissions": "2500.50"
    },
    "children": [
      {
        "user": {
          "id": "uuid",
          "email": "referred@example.com", 
          "level": 2,
          "totalVolume": "75000.00"
        },
        "children": []
      }
    ]
  }
}
```

#### Get Earnings Breakdown
```http
GET /api/referral/earnings/{userId}?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

#### Validate Claim
```http
POST /api/referral/claim
Authorization: Bearer <token>

{
  "userId": "uuid",
  "tokenType": "USDC",
  "walletAddress": "0x..."
}
```

#### Trade Webhook
```http
POST /api/webhook/trade
X-API-Key: <webhook_secret>

{
  "userId": "uuid",
  "tradeType": "SPOT",
  "baseAsset": "BTC",
  "quoteAsset": "USDC", 
  "side": "BUY",
  "volume": "1.5",
  "price": "45000",
  "chain": "EVM",
  "network": "Arbitrum",
  "transactionHash": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tradeId": "uuid",
    "status": "SUCCESS",
    "commissionsDistributed": [
      {
        "level": 1,
        "earnerId": "uuid",
        "amount": "202.50",
        "rate": "0.30"
      }
    ]
  }
}
```

### Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": "Additional error context"
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication required
- `REFERRAL_CODE_NOT_FOUND`: Invalid referral code
- `MAX_REFERRAL_DEPTH_EXCEEDED`: Chain too long
- `INSUFFICIENT_COMMISSION_BALANCE`: Cannot claim
- `RATE_LIMIT_EXCEEDED`: Too many requests

## 🧪 Testing

### Unit Tests
```bash
# Run unit tests
npm run test

# Run with coverage
npm run test -- --coverage
```

### Integration Tests
```bash
# Setup test database
createdb nika_referral_test

# Run integration tests
npm run test:integration
```

### Test Coverage

The test suite covers:
- ✅ Commission calculation edge cases
- ✅ Fee tier optimization logic
- ✅ Custom commission structures
- ✅ Referral chain validation
- ✅ API endpoint functionality
- ✅ Error handling scenarios
- ✅ Race condition safety

## 📊 Performance Considerations

### Database Optimizations

1. **Indexes**: Strategic indexing on frequent queries
   ```sql
   CREATE INDEX idx_user_referrer ON users(referrer_id);
   CREATE INDEX idx_commission_earner ON commissions(earner_id);
   CREATE INDEX idx_trade_user_date ON trades(user_id, created_at);
   ```

2. **Pagination**: All list endpoints support pagination
3. **Caching**: Referral network stats cached for 5 minutes
4. **Transactions**: Commission distribution uses atomic transactions

### Scaling Strategy

1. **Horizontal Scaling**: Stateless API design
2. **Database Sharding**: User-based partitioning strategy
3. **Queue Processing**: Async commission calculation for high volume
4. **CDN Integration**: Static referral link generation

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication
- User-scoped data access validation
- API key authentication for webhooks
- Rate limiting per user

### Data Protection
- Password hashing with bcrypt (12 rounds)
- Input sanitization and validation
- SQL injection prevention via Prisma ORM
- XSS protection with helmet.js

### Financial Security
- Decimal.js for precise financial calculations
- Transaction-based commission distribution
- Duplicate trade prevention
- Claim validation and tracking

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   JWT_SECRET=strong-secret-key
   WEBHOOK_API_KEY=webhook-secret
   ```

2. **Database Migration**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start ecosystem.config.js
   ```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Monitoring
- Health check endpoint: `GET /health`
- Metrics collection via custom middleware
- Error tracking and alerting
- Database connection monitoring

## 📈 Analytics & Monitoring

### Key Metrics
- Commission distribution volume
- Referral conversion rates
- Fee tier optimization impact
- API response times
- Error rates by endpoint

### Dashboards
- Real-time commission flow
- Top referrer leaderboards
- Network growth analytics
- Revenue impact tracking

## 🔮 Future Enhancements

### Planned Features
1. **Multi-Token Support**: Native support for various reward tokens
2. **Dynamic Commission Rates**: Time-based and volume-based adjustments
3. **Referral Contests**: Gamification and competitions
4. **Advanced Analytics**: ML-powered insights and predictions
5. **Mobile SDK**: React Native integration
6. **Webhook Retries**: Resilient external integrations

### Technical Improvements
1. **GraphQL API**: Alternative to REST endpoints
2. **Event Sourcing**: Immutable commission history
3. **Microservices**: Service decomposition for scale
4. **Real-time Updates**: WebSocket commission notifications

## 📞 Support

### Development Team
- **Backend Lead**: Nika Engineering Team
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest with comprehensive coverage
- **Documentation**: API docs and business logic

### Getting Help
1. Check the API documentation at `/api/docs`
2. Review test cases for usage examples
3. Check the health endpoint for system status
4. Review logs for error debugging

---

Built with ❤️ by the Nika Engineering Team
