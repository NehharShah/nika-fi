# Design Decisions & Architecture

This document explains the key technical and business decisions made in implementing the Nika Referral System.

## 🏗️ Architecture Decisions

### 1. Layered Architecture

**Decision**: Implemented a layered architecture with clear separation of concerns.

**Layers:**
- **Controllers**: HTTP request handling and validation
- **Services**: Business logic orchestration  
- **Utils**: Pure business logic and calculations
- **Database**: Data access abstraction

**Rationale:**
- **Maintainability**: Clear boundaries make code easier to understand and modify
- **Testability**: Each layer can be unit tested in isolation
- **Scalability**: Business logic can be extracted to microservices later
- **Team Collaboration**: Multiple developers can work on different layers

**Trade-offs:**
- More boilerplate code compared to a monolithic approach
- Potential performance overhead from layer abstractions
- Initial complexity for simple operations

### 2. Prisma ORM Choice

**Decision**: Used Prisma as the database ORM.

**Rationale:**
- **Type Safety**: Full TypeScript integration with generated types
- **Developer Experience**: Excellent tooling and migration system
- **Performance**: Query optimization and connection pooling
- **Database Agnostic**: Easy to switch between PostgreSQL, MySQL, etc.
- **Schema Management**: Version-controlled database schema

**Alternatives Considered:**
- **TypeORM**: More mature but less type-safe
- **Raw SQL**: Maximum performance but no type safety
- **Sequelize**: Good ORM but weaker TypeScript support

### 3. PostgreSQL Database Choice

**Decision**: PostgreSQL as the primary database.

**Rationale:**
- **ACID Compliance**: Critical for financial data integrity
- **JSON Support**: Flexible storage for custom commission structures
- **Performance**: Excellent query optimization and indexing
- **Decimal Precision**: Native support for financial calculations
- **Ecosystem**: Rich extension ecosystem (PostGIS, full-text search)

**Alternatives Considered:**
- **MySQL**: Good performance but weaker JSON support
- **MongoDB**: NoSQL flexibility but lacks ACID guarantees
- **Redis**: Fast but not suitable for primary financial data

## 💼 Business Logic Decisions

### 1. Commission Calculation Strategy

**Decision**: Calculate commissions immediately upon trade completion.

**Implementation:**
```typescript
// Trade webhook triggers immediate commission calculation
async processTradeWebhook(request: TradeWebhookRequest) {
  return this.db.executeTransaction(async (tx) => {
    // 1. Create trade record
    // 2. Calculate effective fee rate
    // 3. Get referral chain
    // 4. Calculate commission distribution
    // 5. Create commission records atomically
  });
}
```

**Rationale:**
- **Real-time Updates**: Users see earnings immediately
- **Data Consistency**: All related records created in single transaction
- **Audit Trail**: Complete history of commission calculations
- **Simplicity**: Easier to debug and understand

**Alternatives Considered:**
- **Batch Processing**: Better performance but delayed updates
- **Event Sourcing**: More complex but better auditability
- **Async Queues**: Decoupled but adds complexity

### 2. Fee Tier Priority System

**Decision**: Fee tiers take priority over signup discounts when beneficial.

**Logic:**
```typescript
// Priority order:
// 1. Custom fee rate (special users)
// 2. Fee tier rate (if better than discounted base)
// 3. Base rate with signup discount

if (bestTier && bestTier.feeRate.lt(discountedBaseRate)) {
  effectiveRate = bestTier.feeRate;
  tierUsed = bestTier.name;
} else {
  effectiveRate = discountedBaseRate;
  tierUsed = 'BASE';
  discountApplied = true;
}
```

**Rationale:**
- **User Benefit**: Always applies the best possible rate
- **Transparency**: Clear logic for fee calculation
- **Incentivization**: Encourages higher trading volume
- **Fairness**: Prevents exploitation of discount system

### 3. 3-Level Referral Depth Limit

**Decision**: Limited referral chains to maximum 3 levels.

**Rationale:**
- **Performance**: Prevents deep recursive queries
- **Business Logic**: Diminishing returns beyond 3 levels
- **Complexity**: Manageable for users to understand
- **Legal Compliance**: Avoids pyramid scheme regulations

**Implementation:**
```typescript
// Validation prevents chains exceeding max depth
if (referralChain.length >= businessRules.maxReferralDepth) {
  throw new Error('MAX_REFERRAL_DEPTH_EXCEEDED');
}
```

### 4. Custom Commission Structures

**Decision**: JSON-based flexible commission structures for special users.

**Schema:**
```typescript
interface CustomCommissionStructure {
  level1Rate?: number;
  level2Rate?: number; 
  level3Rate?: number;
  type: 'KOL_50' | 'KOL_CUSTOM' | 'STANDARD';
  description?: string;
}
```

**Rationale:**
- **Flexibility**: Can accommodate any commission structure
- **Future-Proof**: Easy to add new types
- **Database Efficiency**: Single field vs multiple tables
- **Type Safety**: Validated at application level

## 🔧 Technical Implementation Decisions

### 1. Decimal.js for Financial Calculations

**Decision**: Used Decimal.js library for all financial mathematics.

**Rationale:**
- **Precision**: Avoids floating-point arithmetic errors
- **Accuracy**: Critical for financial calculations
- **Standards**: Industry best practice for money handling
- **Legal**: Required for regulatory compliance

**Example:**
```typescript
// Wrong: 0.1 + 0.2 = 0.30000000000000004
const wrong = 0.1 + 0.2;

// Right: 0.1 + 0.2 = 0.3
const right = new Decimal(0.1).add(0.2);
```

### 2. Transaction-Based Commission Distribution

**Decision**: All commission operations wrapped in database transactions.

**Implementation:**
```typescript
return this.db.executeTransaction(async (tx) => {
  const trade = await tx.trade.create({ data: tradeData });
  const commissions = await tx.commission.createMany({ data: commissionsData });
  await tx.user.update({ 
    where: { id: userId },
    data: { totalTradeVolume: { increment: tradeValue } }
  });
  return { trade, commissions };
});
```

**Rationale:**
- **Atomicity**: All operations succeed or fail together
- **Consistency**: No partial commission distributions
- **Race Conditions**: Prevents concurrent modification issues
- **Data Integrity**: Maintains referential integrity

### 3. JWT Authentication Strategy

**Decision**: JWT tokens for user authentication.

**Rationale:**
- **Stateless**: No server-side session storage needed
- **Scalable**: Works across multiple server instances
- **Standard**: Industry-standard authentication method
- **Flexible**: Easy to add custom claims

**Security Measures:**
- Short expiration times (7 days default)
- Strong secret key rotation
- Token validation on every request
- User access scope validation

### 4. API Key Authentication for Webhooks

**Decision**: Separate API key authentication for webhook endpoints.

**Rationale:**
- **Security**: Different authentication for different access patterns
- **Integration**: Easier for external systems to integrate
- **Monitoring**: Separate rate limiting and logging
- **Scalability**: Can be distributed independently

### 5. Comprehensive Input Validation

**Decision**: Multiple layers of input validation using Joi schemas.

**Layers:**
1. **Schema Validation**: Structure and type checking
2. **Business Validation**: Domain-specific rules
3. **Security Validation**: XSS and injection prevention
4. **Authorization**: User access control

**Example:**
```typescript
const schema = Joi.object({
  email: Joi.string().email().max(254).required(),
  referralCode: Joi.string().pattern(/^NIKA[A-Z0-9]{4}$/).optional(),
});
```

## 🚀 Performance Decisions

### 1. Pagination Strategy

**Decision**: Offset-based pagination with configurable limits.

**Implementation:**
```typescript
const pagination = PaginationUtils.calculatePagination(page, limit);
// SELECT * FROM table OFFSET pagination.offset LIMIT pagination.limit
```

**Rationale:**
- **Simplicity**: Easy to implement and understand
- **Flexibility**: Works with any sorting order
- **Client-Friendly**: Simple page number navigation

**Trade-offs:**
- Performance degrades with high offsets
- Not suitable for real-time data streams
- Potential data inconsistency during pagination

**Future Enhancement**: Cursor-based pagination for better performance.

### 2. Caching Strategy

**Decision**: Simple in-memory caching for frequently accessed data.

**Implementation:**
```typescript
// Cache referral network stats for 5 minutes
const cached = CacheUtils.get(`network_${userId}`);
if (cached) return cached;

const stats = await calculateNetworkStats(userId);
CacheUtils.set(`network_${userId}`, stats, 5 * 60 * 1000);
```

**Rationale:**
- **Performance**: Reduces database queries for expensive operations
- **Simplicity**: No external dependencies
- **Development**: Easy to implement and debug

**Limitations:**
- Memory usage scales with cache size
- No cache invalidation strategy
- Lost on server restart

**Future Enhancement**: Redis-based distributed caching.

### 3. Database Indexing Strategy

**Decision**: Strategic indexes on high-frequency query columns.

**Indexes:**
```sql
-- User lookups
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_referral_code ON users(referral_code);
CREATE INDEX idx_user_referrer ON users(referrer_id);

-- Commission queries
CREATE INDEX idx_commission_earner ON commissions(earner_id);
CREATE INDEX idx_commission_date ON commissions(created_at);
CREATE INDEX idx_commission_status ON commissions(status);

-- Trade queries  
CREATE INDEX idx_trade_user ON trades(user_id);
CREATE INDEX idx_trade_date ON trades(created_at);
```

**Rationale:**
- **Query Performance**: Faster lookups on frequent operations
- **Join Optimization**: Improves referral chain traversal
- **Analytical Queries**: Supports earnings and statistics queries

## 🔐 Security Decisions

### 1. Rate Limiting Strategy

**Decision**: User-based rate limiting with different limits per endpoint.

**Implementation:**
```typescript
// Different limits for different operations
router.post('/register', rateLimitByUser(10, 15 * 60 * 1000)); // 10/15min
router.get('/earnings', rateLimitByUser(30, 60 * 1000)); // 30/1min
router.post('/webhook/trade', rateLimitByUser(1000, 60 * 1000)); // 1000/1min
```

**Rationale:**
- **DoS Protection**: Prevents abuse and system overload
- **User Experience**: Different limits for different usage patterns
- **Business Protection**: Prevents malicious commission farming

### 2. Input Sanitization

**Decision**: Multi-layer input sanitization and validation.

**Layers:**
1. **Content-Type Validation**: Ensures proper request format
2. **Schema Validation**: Structure and type checking
3. **String Sanitization**: Removes potentially harmful content
4. **Business Validation**: Domain-specific rules

**Rationale:**
- **XSS Prevention**: Protects against cross-site scripting
- **Injection Prevention**: SQL and NoSQL injection protection
- **Data Integrity**: Ensures clean data storage

### 3. Error Information Disclosure

**Decision**: Different error details for development vs production.

**Implementation:**
```typescript
const isDevelopment = config.nodeEnv === 'development';

res.status(500).json({
  success: false,
  error: 'INTERNAL_SERVER_ERROR',
  message: 'Something went wrong',
  ...(isDevelopment && { 
    stack: err.stack,
    details: err.message 
  }),
});
```

**Rationale:**
- **Security**: Prevents information leakage in production
- **Development**: Detailed errors for debugging
- **User Experience**: Friendly error messages

## 🧪 Testing Decisions

### 1. Test Strategy

**Decision**: Comprehensive unit and integration testing.

**Test Types:**
- **Unit Tests**: Pure business logic testing
- **Integration Tests**: Full API endpoint testing
- **Database Tests**: Data persistence validation
- **Error Tests**: Edge case and error handling

**Rationale:**
- **Confidence**: High confidence in code changes
- **Regression Prevention**: Catches breaking changes
- **Documentation**: Tests serve as usage examples
- **Refactoring Safety**: Enables safe code improvements

### 2. Test Data Management

**Decision**: Fresh test database for each test run.

**Implementation:**
```typescript
beforeEach(async () => {
  await cleanDatabase();
  await seedTestData();
});
```

**Rationale:**
- **Isolation**: Tests don't affect each other
- **Predictability**: Known state for each test
- **Debugging**: Easier to reproduce test failures

## 📊 Monitoring & Observability

### 1. Logging Strategy

**Decision**: Structured logging with request correlation.

**Implementation:**
```typescript
// Add request ID to all logs
req.headers['x-request-id'] = generateRequestId();

// Log with context
console.log({
  requestId: req.headers['x-request-id'],
  userId: req.user?.id,
  action: 'commission_calculated',
  amount: commission.amount,
});
```

**Rationale:**
- **Debugging**: Easy to trace request flows
- **Analytics**: Structured data for analysis
- **Monitoring**: Enables alerting and dashboards

### 2. Health Check Implementation

**Decision**: Comprehensive health check endpoint.

**Checks:**
- Server responsiveness
- Database connectivity
- Critical service availability
- Basic system information

**Rationale:**
- **Monitoring**: External systems can check health
- **Deployment**: Ensures successful deployments
- **Debugging**: Quick system status overview

## 🔮 Future Considerations

### Scalability Decisions

1. **Microservices Migration**: Extract commission calculation to separate service
2. **Database Sharding**: Partition by user ID for horizontal scaling
3. **Event Sourcing**: Immutable event log for auditability
4. **CQRS**: Separate read/write models for performance

### Technology Evolution

1. **GraphQL**: More flexible API queries
2. **Redis**: Distributed caching and session storage
3. **Kubernetes**: Container orchestration
4. **Monitoring**: APM tools like DataDog or New Relic

### Business Logic Evolution

1. **Machine Learning**: Predictive commission optimization
2. **Real-time**: WebSocket updates for live commissions
3. **Multi-chain**: Support for additional blockchain networks
4. **Gamification**: Achievement and contest systems

---

These design decisions balance immediate business needs with long-term scalability and maintainability. Each decision includes trade-offs and future enhancement paths to guide system evolution.
