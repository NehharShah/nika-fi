# Nika Referral System

A commission-based referral system backend implementing 3-level cascade commissions, dynamic fee tiers, and multi-chain support.

## 🚀 Quick Start

```bash
# Local Development
npm install
npx prisma db push && npx prisma db seed
npm run dev

# Docker Production
docker compose build && docker compose up -d
curl http://localhost:3000/health

# Test Registration + Trade
curl -X POST http://localhost:3000/api/referral/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPass1!"}'
```

## 📋 Core Features

- **3-Level Commission**: 30% → 3% → 2% cascade
- **Dynamic Fee Tiers**: Volume-based optimization  
- **Multi-Chain**: EVM + SVM support
- **Production Ready**: Docker, tests, monitoring

## 📚 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/referral/register` | Register user with referral code |
| `POST` | `/api/referral/generate` | Generate referral code |
| `GET` | `/api/referral/network/{userId}` | View referral network |
| `GET` | `/api/referral/earnings/{userId}` | Get earnings breakdown |
| `POST` | `/api/referral/claim` | Validate claim request |
| `POST` | `/api/webhook/trade` | Process trade webhook |

## 🧪 Testing

```bash
npm test              # Unit tests
npm run test:integration  # Integration tests
```

## 🚀 Production

```bash
# Docker
docker compose build && docker compose up -d

# Health Check
curl http://localhost:3000/health
```