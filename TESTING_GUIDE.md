# Opinion Markets - Comprehensive Testing Guide

**Date**: February 21, 2026
**Status**: Phase 3 Complete - Ready for Testing

---

## 🚀 Pre-Testing Setup

### 1. Environment Setup
```bash
git clone <repo> && cd opinion-markets
cd frontend && npm install --legacy-peer-deps && cd ..
cd api && npm install && cd ..
cp .env.example .env
nano .env  # Edit with your values
```

### 2. Database Setup
```bash
# Docker Compose
docker-compose up -d

# Or manual PostgreSQL
createdb opinion_markets
```

### 3. Start Services
```bash
# Terminal 1: Frontend (port 3000)
cd frontend && npm run dev

# Terminal 2: API (port 3001)
cd api && npm run dev

# Verify
curl http://localhost:3001/health
```

---

## ✅ Testing Checklist

### Feed Page (http://localhost:3000)
- [ ] Page loads without errors
- [ ] Market cards render in grid
- [ ] Wallet button visible
- [ ] Infinite scroll loads more markets
- [ ] Filters (Active/All) work
- [ ] Sorting works
- [ ] Mobile responsive (single column)
- [ ] Tablet responsive (2 columns)
- [ ] Desktop responsive (3 columns)

### Market Detail (/markets/:id)
- [ ] Statement displays
- [ ] Sentiment dial animates
- [ ] Dial colors correct (Red→Yellow→Green)
- [ ] Opinions feed shows all stakes
- [ ] Opinions ranked by amount
- [ ] "Stake Opinion" button visible for active markets
- [ ] Button hidden for closed markets

### Stake Opinion Flow (/markets/:id/stake)
- [ ] Step 1: Amount slider works ($0.50-$10)
- [ ] Step 2: Opinion text input validates (max 280)
- [ ] Step 3: Review shows correct info
- [ ] Step 4: Confirmation displays
- [ ] Navigation between steps works
- [ ] Form validation prevents invalid input

### Create Market (/markets/create)
- [ ] Step 1: Statement input works
- [ ] Step 2: Duration selection works (4 options)
- [ ] Step 3: Review shows $5 fee
- [ ] Step 4: Confirmation displays
- [ ] Back buttons work correctly

### User Profile (/profile)
- [ ] Requires wallet connection
- [ ] Shows portfolio stats (staked, won, ROI, win rate)
- [ ] Positions tab displays all positions
- [ ] Stats tab shows detailed breakdown
- [ ] Mobile responsive

### Results Page (/markets/:id/results)
- [ ] Shows sentiment dial (locked)
- [ ] Winner announcement if user won
- [ ] All opinions displayed (read-only)
- [ ] Share to Twitter button works
- [ ] Download card button works

---

## 🔌 API Testing

### Health
```bash
curl http://localhost:3001/health
```

### Markets
```bash
# List
curl "http://localhost:3001/markets?limit=10&state=Active"

# Detail
curl "http://localhost:3001/markets/:id"

# Create
curl -X POST http://localhost:3001/markets \
  -H "Content-Type: application/json" \
  -d '{"statement":"...", "duration":604800, "creator":"...", "signature":"..."}'

# Stake
curl -X POST http://localhost:3001/markets/:id/stake \
  -H "Content-Type: application/json" \
  -d '{"staker":"...", "amount":1000000, "opinion_text":"...", "signature":"..."}'
```

### User
```bash
curl "http://localhost:3001/user/:wallet"
curl "http://localhost:3001/user/:wallet/positions"
```

### Sentiment
```bash
curl "http://localhost:3001/sentiment/history"
curl "http://localhost:3001/sentiment/topic?q=bitcoin"
```

---

## 🐛 Bug Reporting

Title: [COMPONENT] Brief Description

Environment:
- Browser: Chrome/Safari/Firefox
- Device: Desktop/Mobile
- OS: macOS/Windows/Linux

Steps to Reproduce:
1. ...
2. ...

Expected Result: ...

Actual Result: ...

Console Error: [if applicable]

---

## 📋 Sign-Off Checklist

Before declaring ready:

### Frontend
- [ ] All pages load
- [ ] All interactions work
- [ ] Responsive on mobile/tablet/desktop
- [ ] No console errors
- [ ] Performance acceptable

### API
- [ ] All endpoints work
- [ ] Pagination works
- [ ] Filtering works
- [ ] Error handling works
- [ ] Input validation works

### Database
- [ ] Schema created
- [ ] Indexes created
- [ ] Data persists
- [ ] Migrations successful

### Integration
- [ ] Frontend ↔ API communication works
- [ ] All features end-to-end functional
- [ ] No security issues found
- [ ] Performance meets targets
- [ ] Documentation accurate

---

**Ready to Test! 🎉**

