# Opinion Markets - Devnet Testing Setup Guide

**Date**: February 21, 2026
**For**: Monday Testing Session
**Duration**: Complete setup to first API call = 5 minutes

---

## ⚡ QUICK START (5 Minutes)

### Step 1: Start Database & Cache
```bash
cd /home/user/Opinion-Markets

# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Verify containers running
docker-compose ps

# Expected output:
# postgres    Up (healthy)
# redis       Up (healthy)
```

### Step 2: Setup Frontend
```bash
cd frontend

# Install dependencies (will use --legacy-peer-deps to handle Solana conflict)
npm install --legacy-peer-deps

# Start frontend on port 3000
npm run dev

# Expected output:
# ▲ Next.js 14.0.4
# - Local: http://localhost:3000
```

### Step 3: Setup API (New Terminal)
```bash
cd api

# Install dependencies
npm install

# Create .env file if not exists
cp ../.env.example ../.env

# Edit .env to ensure DATABASE_URL is set
nano ../.env

# Should have:
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/opinion_markets

# Start API server on port 3001
npm run dev

# Expected output:
# ✅ API server listening
# 📦 port: 3001
```

### Step 4: Verify Setup (New Terminal)
```bash
# Check API health
curl http://localhost:3001/health

# Expected response:
# {"status":"healthy","timestamp":"2026-02-21T...","uptime":X,"environment":"development"}

# Check API version
curl http://localhost:3001/api/version

# Expected response:
# {"version":"0.1.0","name":"Opinion Markets API","status":"beta"}

# List markets (should be empty initially)
curl http://localhost:3001/markets

# Expected response:
# {"success":true,"data":[],"pagination":{"limit":20,"offset":0,"total":0,"hasMore":false}}
```

---

## 🧪 COMPREHENSIVE TESTING (30 Minutes)

### Test 1: Create a Market
```bash
# Create test market (24 hour duration = 86400 seconds)
curl -X POST http://localhost:3001/markets \
  -H "Content-Type: application/json" \
  -d '{
    "statement": "Will Bitcoin reach $100k by end of 2026?",
    "duration": 86400,
    "creator": "test_wallet_alice",
    "signature": "mock_signature_12345"
  }'

# Save the market ID from response:
# {"success":true,"data":{"id":"market_xxx","uuid":"yyy",...}}

export MARKET_ID="market_xxx"  # Replace with actual ID
```

### Test 2: Get Market Details
```bash
curl http://localhost:3001/markets/$MARKET_ID

# Should return market with empty opinions array
```

### Test 3: Stake an Opinion
```bash
# Stake $5 on the market
curl -X POST http://localhost:3001/markets/$MARKET_ID/stake \
  -H "Content-Type: application/json" \
  -d '{
    "staker": "test_wallet_alice",
    "amount": 5000000,
    "opinion_text": "Bitcoin will definitely reach $100k, fundamentals are strong",
    "signature": "mock_signature_12345"
  }'

# Expected: Opinion created successfully
```

### Test 4: Add More Stakers
```bash
# Stake 2 more opinions from different wallets
curl -X POST http://localhost:3001/markets/$MARKET_ID/stake \
  -H "Content-Type: application/json" \
  -d '{
    "staker": "test_wallet_bob",
    "amount": 3000000,
    "opinion_text": "Bitcoin might reach $100k but crypto is risky",
    "signature": "mock_signature_12345"
  }'

curl -X POST http://localhost:3001/markets/$MARKET_ID/stake \
  -H "Content-Type: application/json" \
  -d '{
    "staker": "test_wallet_charlie",
    "amount": 2000000,
    "opinion_text": "Bitcoin wont reach $100k",
    "signature": "mock_signature_12345"
  }'
```

### Test 5: Verify Market Updated
```bash
curl http://localhost:3001/markets/$MARKET_ID

# Should show:
# "total_stake": 10000000  (3 users x opinions)
# "staker_count": 3
# "opinions": [3 opinions listed]
```

### Test 6: Get User Portfolio
```bash
# Get portfolio for alice
curl http://localhost:3001/user/test_wallet_alice

# Expected response:
# {
#   "success": true,
#   "data": {
#     "wallet_address": "test_wallet_alice",
#     "total_staked": 5000000,
#     "total_prize_won": 0,
#     "positions_count": 1,
#     "win_count": 0,
#     "win_rate": 0,
#     "roi": 0
#   }
# }
```

### Test 7: Get User Positions
```bash
curl http://localhost:3001/user/test_wallet_alice/positions

# Should show alice's position with stake amount, market_id, state, etc.
```

### Test 8: List Markets with Pagination
```bash
# Get markets with limit and offset
curl "http://localhost:3001/markets?limit=10&offset=0&state=Active&sortBy=closesAt"

# Should return paginated results with hasMore flag
```

### Test 9: Frontend Testing (Open in Browser)
Navigate to:
```
http://localhost:3000
```

**What to Test:**
1. Feed page loads and shows markets ✅
2. Market card displays correctly ✅
3. Click on market to see details ✅
4. Connect wallet button visible ✅
5. Create market button works ✅
6. Create market flow (4 steps) ✅
7. Stake opinion form works ✅
8. Profile page loads ✅
9. Portfolio stats display ✅
10. Position history shows ✅

---

## 🐛 DEBUGGING TIPS

### API Not Responding?
```bash
# Check if API is running
ps aux | grep node

# View API logs
docker-compose logs api -f

# Restart API
npm run dev --prefix api
```

### Database Connection Error?
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database exists
psql -U postgres -h localhost -c "\l"

# Check connection string
echo $DATABASE_URL
# Should be: postgres://postgres:postgres@localhost:5432/opinion_markets
```

### Frontend Won't Connect to API?
```bash
# Check NEXT_PUBLIC_API_URL
grep -r "NEXT_PUBLIC_API_URL" frontend/

# Should be: http://localhost:3001

# Verify API is accessible
curl http://localhost:3001/health
```

### Port Already in Use?
```bash
# Find what's using port 3000
lsof -i :3000

# Find what's using port 3001
lsof -i :3001

# Find what's using port 5432
lsof -i :5432

# Kill process if needed
kill -9 <PID>
```

---

## 📊 AUTOMATED TESTING SUITE

### Option 1: Run Full Test Suite
```bash
cd api

# Install testing dependencies
npm install axios

# Run automated tests
npx ts-node src/testing/runTests.ts

# Expected output:
# ╔════════════════════════════════════════════════════════╗
# ║          Opinion Markets - Testing Suite               ║
# ╚════════════════════════════════════════════════════════╝
#
# 📡 CONNECTIVITY & HEALTH CHECK
# ✅ API is healthy
#
# 📊 MARKET OPERATIONS
# ✅ Market created
# ✅ Opinions staked
# ...
#
# ✅ SUCCESS RATE: 100%
```

### Option 2: Run Individual Tests
```bash
# Test API connection
curl -i http://localhost:3001/health

# Test market creation (save market ID)
MARKET_ID=$(curl -s -X POST http://localhost:3001/markets \
  -H "Content-Type: application/json" \
  -d '{"statement":"Test","duration":86400,"creator":"test","signature":"mock"}' \
  | jq -r '.data.id')

echo "Market ID: $MARKET_ID"

# Test opinion staking
curl -i -X POST http://localhost:3001/markets/$MARKET_ID/stake \
  -H "Content-Type: application/json" \
  -d '{"staker":"test_user","amount":5000000,"opinion_text":"test","signature":"mock"}'
```

---

## 🔍 MONITORING & LOGS

### View Real-Time Logs
```bash
# Frontend logs
npm run dev --prefix frontend 2>&1 | tee frontend.log

# API logs
npm run dev --prefix api 2>&1 | tee api.log

# Database logs
docker-compose logs postgres -f

# Redis logs
docker-compose logs redis -f
```

### Check System Health
```bash
# Disk space
df -h

# Memory usage
free -h

# CPU usage
top

# Docker containers
docker-compose ps

# Check specific service health
docker-compose exec postgres pg_isready
docker-compose exec redis redis-cli ping
```

---

## 📈 PERFORMANCE TESTING

### Load Testing (Light)
```bash
# Create 50 markets and stake opinions on each
for i in {1..50}; do
  MARKET=$(curl -s -X POST http://localhost:3001/markets \
    -H "Content-Type: application/json" \
    -d "{\"statement\":\"Market $i\",\"duration\":86400,\"creator\":\"user_$i\",\"signature\":\"mock\"}" \
    | jq -r '.data.id')

  curl -s -X POST http://localhost:3001/markets/$MARKET/stake \
    -H "Content-Type: application/json" \
    -d "{\"staker\":\"staker_$i\",\"amount\":5000000,\"opinion_text\":\"opinion $i\",\"signature\":\"mock\"}" \
    > /dev/null

  echo "Market $i created and staked"
done

# Check response times
time curl http://localhost:3001/markets
```

### Memory Usage Check
```bash
# Before testing
ps aux | grep "node\|postgres" | grep -v grep

# After heavy testing
ps aux | grep "node\|postgres" | grep -v grep

# Should not increase significantly
```

---

## 🧹 CLEANUP

### Stop All Services
```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: deletes database!)
docker-compose down -v
```

### Reset Database
```bash
# Drop database and recreate
docker-compose down
docker-compose up -d postgres
# Database will be empty and ready for fresh testing
```

### Clear Frontend Cache
```bash
# Clear Next.js cache
rm -rf frontend/.next

# Clear node_modules and reinstall
rm -rf frontend/node_modules
npm install --legacy-peer-deps --prefix frontend
```

---

## ✅ SUCCESS CRITERIA

### API Testing
- [ ] /health returns 200 status
- [ ] /api/version returns 200 status
- [ ] POST /markets creates market successfully
- [ ] POST /markets/:id/stake records opinion
- [ ] GET /user/:wallet returns portfolio
- [ ] All endpoints return proper JSON
- [ ] No 500 errors in logs

### Frontend Testing
- [ ] Homepage loads without errors
- [ ] Feed displays markets
- [ ] Market detail page loads
- [ ] Create market form works (4 steps)
- [ ] Stake opinion form works
- [ ] Profile page displays stats
- [ ] Mobile responsive layout works
- [ ] No console errors

### Database Testing
- [ ] PostgreSQL is running
- [ ] Database connection successful
- [ ] Markets table has data
- [ ] Opinions table has data
- [ ] Positions table has data
- [ ] user_portfolio table has data

---

## 🚀 NEXT STEPS

1. **✅ Run Setup** (5 min)
   - Start docker containers
   - Start frontend and API

2. **✅ Basic Testing** (10 min)
   - Test API endpoints with curl
   - Create markets and stake opinions
   - Verify database updates

3. **✅ Frontend Testing** (10 min)
   - Open browser and test UI
   - Test all pages and flows
   - Check mobile responsiveness

4. **✅ Automated Tests** (5 min)
   - Run full test suite
   - Verify all tests pass
   - Check for errors in logs

5. **✅ Document Issues** (5 min)
   - Note any bugs or issues found
   - Check CODE_REVIEW.md for known issues
   - Report critical issues immediately

**Expected Total Time: 35-40 minutes**

Good luck with testing! 🎉
