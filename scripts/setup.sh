#!/bin/bash

# Nika Referral System Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Nika Referral System..."

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is required but not installed. Please install PostgreSQL 14+."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/nika_referral?schema=public"

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production-$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# API Configuration
API_VERSION=v1

# Logging
LOG_LEVEL=info

# Referral System Configuration
MAX_REFERRAL_DEPTH=3
DEFAULT_DIRECT_COMMISSION_RATE=0.30
DEFAULT_LEVEL2_COMMISSION_RATE=0.03
DEFAULT_LEVEL3_COMMISSION_RATE=0.02
DEFAULT_FEE_DISCOUNT_RATE=0.10
BASE_FEE_TIER_RATE=0.01

# Webhook API Key
WEBHOOK_API_KEY=nika-webhook-secret-key-$(openssl rand -base64 32)
EOL
    echo "✅ Created .env file with secure secrets"
else
    echo "✅ .env file already exists"
fi

# Database setup
echo "🗄️  Setting up database..."

# Create database if it doesn't exist
echo "Creating database (if not exists)..."
createdb nika_referral 2>/dev/null || echo "Database already exists"

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Push database schema
echo "Pushing database schema..."
npx prisma db push --force-reset

# Seed database
echo "Seeding database with sample data..."
npx prisma db seed

echo "✅ Database setup complete"

# Build project
echo "🔨 Building project..."
npm run build

echo "🎉 Setup complete!"
echo ""
echo "📚 Quick Start:"
echo "  • Start development server: npm run dev"
echo "  • Run tests: npm test"
echo "  • View API docs: http://localhost:3000/api/docs"
echo "  • Health check: http://localhost:3000/health"
echo ""
echo "🧪 Test Users (password: password123):"
echo "  • Admin: admin@nika.trade"
echo "  • KOL 1: kol1@example.com (50% commission)"
echo "  • KOL 2: kol2@example.com (custom commission)"
echo "  • User 1: user1@example.com (referred by KOL1)"
echo "  • User 2: user2@example.com (referred by User1)"
echo "  • User 3: user3@example.com (referred by User2)"
echo ""
echo "🔗 Referral Code Examples:"
echo "  • NIKAADMN (Admin)"
echo "  • NIKAKOL1 (KOL 1)"
echo "  • NIKAKOL2 (KOL 2)"
echo "  • NIKA1USR (User 1)"
echo ""
echo "🚀 Start the server with: npm run dev"
