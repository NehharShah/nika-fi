#!/bin/bash

# Nika Referral System API Examples
# This script demonstrates how to use the referral system API

set -e

# Configuration
BASE_URL="http://localhost:3000"
WEBHOOK_API_KEY="nika-webhook-secret-key"

echo "🚀 Nika Referral System API Examples"
echo "Base URL: $BASE_URL"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    echo -e "${BLUE}→ $method $endpoint${NC}"
    
    if [ -n "$data" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -X "$method" \
                -H "Content-Type: application/json" \
                $headers \
                -d "$data" \
                "$BASE_URL$endpoint")
        else
            response=$(curl -s -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$BASE_URL$endpoint")
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -X "$method" \
                $headers \
                "$BASE_URL$endpoint")
        else
            response=$(curl -s -X "$method" \
                "$BASE_URL$endpoint")
        fi
    fi
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
}

# Extract JSON value helper
extract_json() {
    echo "$1" | jq -r "$2" 2>/dev/null
}

# Check if server is running
echo -e "${YELLOW}📡 Checking server health...${NC}"
health_response=$(curl -s "$BASE_URL/health" || echo '{"success":false}')
if [[ $(extract_json "$health_response" '.success') != "true" ]]; then
    echo -e "${RED}❌ Server is not running. Please start the server first:${NC}"
    echo "   npm run dev"
    echo "   or"
    echo "   docker-compose up"
    exit 1
fi
echo -e "${GREEN}✅ Server is healthy${NC}"
echo ""

# Example 1: Health Check
echo -e "${YELLOW}1. Health Check${NC}"
api_call "GET" "/health"

# Example 2: API Documentation
echo -e "${YELLOW}2. API Documentation${NC}"
api_call "GET" "/api/docs"

# Example 3: User Registration (without referral)
echo -e "${YELLOW}3. User Registration (No Referral)${NC}"
user1_data='{
  "email": "alice@example.com",
  "username": "alice_trader",
  "password": "password123"
}'
user1_response=$(api_call "POST" "/api/referral/register" "$user1_data")
user1_token=$(extract_json "$user1_response" '.data.token')
user1_id=$(extract_json "$user1_response" '.data.user.id')
user1_referral_code=$(extract_json "$user1_response" '.data.user.referralCode')

echo -e "${GREEN}User 1 ID: $user1_id${NC}"
echo -e "${GREEN}User 1 Referral Code: $user1_referral_code${NC}"

# Example 4: User Registration (with referral)
echo -e "${YELLOW}4. User Registration (With Referral)${NC}"
user2_data="{
  \"email\": \"bob@example.com\",
  \"username\": \"bob_trader\",
  \"password\": \"password123\",
  \"referralCode\": \"$user1_referral_code\"
}"
user2_response=$(api_call "POST" "/api/referral/register" "$user2_data")
user2_token=$(extract_json "$user2_response" '.data.token')
user2_id=$(extract_json "$user2_response" '.data.user.id')
user2_referral_code=$(extract_json "$user2_response" '.data.user.referralCode')

echo -e "${GREEN}User 2 ID: $user2_id${NC}"
echo -e "${GREEN}User 2 Referral Code: $user2_referral_code${NC}"

# Example 5: Generate Referral Code
echo -e "${YELLOW}5. Generate Referral Code${NC}"
referral_data="{\"userId\": \"$user1_id\"}"
api_call "POST" "/api/referral/generate" "$referral_data" "-H \"Authorization: Bearer $user1_token\""

# Example 6: Validate Referral Code
echo -e "${YELLOW}6. Validate Referral Code${NC}"
api_call "GET" "/api/referral/validate-code/$user1_referral_code"

# Example 7: Process Trade (Generate Commission)
echo -e "${YELLOW}7. Process Trade Webhook${NC}"
trade_data="{
  \"userId\": \"$user2_id\",
  \"tradeType\": \"SPOT\",
  \"baseAsset\": \"BTC\",
  \"quoteAsset\": \"USDC\",
  \"side\": \"BUY\",
  \"volume\": \"1.0\",
  \"price\": \"45000\",
  \"chain\": \"EVM\",
  \"network\": \"Arbitrum\",
  \"transactionHash\": \"0x1234567890abcdef1234567890abcdef12345678\"
}"
trade_response=$(api_call "POST" "/api/webhook/trade" "$trade_data" "-H \"X-API-Key: $WEBHOOK_API_KEY\"")
trade_id=$(extract_json "$trade_response" '.data.tradeId')

echo -e "${GREEN}Trade ID: $trade_id${NC}"

# Wait a moment for commission to be processed
sleep 2

# Example 8: Check Referral Network
echo -e "${YELLOW}8. Check Referral Network${NC}"
api_call "GET" "/api/referral/network/$user1_id" "" "-H \"Authorization: Bearer $user1_token\""

# Example 9: Check Earnings Breakdown
echo -e "${YELLOW}9. Check Earnings Breakdown${NC}"
api_call "GET" "/api/referral/earnings/$user1_id" "" "-H \"Authorization: Bearer $user1_token\""

# Example 10: Validate Claim Request
echo -e "${YELLOW}10. Validate Claim Request${NC}"
claim_data="{
  \"userId\": \"$user1_id\",
  \"tokenType\": \"USDC\",
  \"walletAddress\": \"0xabcdef1234567890abcdef1234567890abcdef12\"
}"
api_call "POST" "/api/referral/claim" "$claim_data" "-H \"Authorization: Bearer $user1_token\""

# Example 11: Register Third User (3-level chain)
echo -e "${YELLOW}11. Register Third User (3-level chain)${NC}"
user3_data="{
  \"email\": \"charlie@example.com\",
  \"username\": \"charlie_trader\",
  \"password\": \"password123\",
  \"referralCode\": \"$user2_referral_code\"
}"
user3_response=$(api_call "POST" "/api/referral/register" "$user3_data")
user3_token=$(extract_json "$user3_response" '.data.token')
user3_id=$(extract_json "$user3_response" '.data.user.id')

# Example 12: Third User Trade (Multi-level Commission)
echo -e "${YELLOW}12. Third User Trade (Multi-level Commission)${NC}"
trade3_data="{
  \"userId\": \"$user3_id\",
  \"tradeType\": \"SPOT\",
  \"baseAsset\": \"ETH\",
  \"quoteAsset\": \"USDC\",
  \"side\": \"SELL\",
  \"volume\": \"10.0\",
  \"price\": \"3000\",
  \"chain\": \"EVM\",
  \"network\": \"Arbitrum\",
  \"transactionHash\": \"0xabcdef1234567890abcdef1234567890abcdef13\"
}"
api_call "POST" "/api/webhook/trade" "$trade3_data" "-H \"X-API-Key: $WEBHOOK_API_KEY\""

# Wait for commissions to be processed
sleep 2

# Example 13: Check Updated Earnings
echo -e "${YELLOW}13. Check Updated Earnings (Multi-level)${NC}"
api_call "GET" "/api/referral/earnings/$user1_id" "" "-H \"Authorization: Bearer $user1_token\""

# Example 14: Check User 2 Earnings
echo -e "${YELLOW}14. Check User 2 Earnings${NC}"
api_call "GET" "/api/referral/earnings/$user2_id" "" "-H \"Authorization: Bearer $user2_token\""

# Example 15: Error Handling Examples
echo -e "${YELLOW}15. Error Handling Examples${NC}"

echo -e "${BLUE}→ Invalid referral code${NC}"
invalid_user_data='{
  "email": "invalid@example.com",
  "username": "invalid_user",
  "password": "password123",
  "referralCode": "INVALID1"
}'
api_call "POST" "/api/referral/register" "$invalid_user_data"

echo -e "${BLUE}→ Unauthorized access${NC}"
api_call "GET" "/api/referral/earnings/$user1_id" "" "-H \"Authorization: Bearer invalid_token\""

echo -e "${BLUE}→ Invalid webhook API key${NC}"
api_call "POST" "/api/webhook/trade" "$trade_data" "-H \"X-API-Key: invalid_key\""

echo -e "${GREEN}🎉 API Examples Complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo "• Created 3 users with referral chain: Alice → Bob → Charlie"
echo "• Processed 2 trades generating multi-level commissions"
echo "• Demonstrated all major API endpoints"
echo "• Showed error handling scenarios"
echo ""
echo -e "${YELLOW}🔗 Referral Chain:${NC}"
echo "• Alice (Level 1): $user1_referral_code → earns from Bob & Charlie's trades"
echo "• Bob (Level 2): $user2_referral_code → earns from Charlie's trades" 
echo "• Charlie (Level 3): User referred by Bob"
echo ""
echo -e "${YELLOW}💰 Commission Flow:${NC}"
echo "• Charlie's trade → Bob gets 30% → Alice gets 3%"
echo "• Bob's trade → Alice gets 30%"
echo ""
echo -e "${BLUE}View detailed earnings:${NC}"
echo "curl -H \"Authorization: Bearer $user1_token\" $BASE_URL/api/referral/earnings/$user1_id"
