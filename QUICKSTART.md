# SneakerCred API - Quick Start

Get the unified API running in 5 minutes.

## Prerequisites

- Node.js 18+
- PostgreSQL 15
- Redis 7
- Docker & Docker Compose (optional)

## Option A: Docker (Recommended - 2 minutes)

```bash
cd backend

# Copy environment
cp .env.example .env

# Start all services
docker-compose up -d

# Check if running
curl http://localhost:3000/health

# View logs
docker-compose logs -f api
```

Done! API running on `http://localhost:3000`

---

## Option B: Manual Setup (5 minutes)

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://user:pass@localhost:5432/sneakercred
# REDIS_URL=redis://localhost:6379
# JWT_SECRET=your-32-character-secret-key-here
```

### 3. Start External Services

Make sure PostgreSQL and Redis are running:

```bash
# macOS with Homebrew
brew services start postgresql
brew services start redis

# Or use Docker just for databases
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sneakercred \
  postgres:15-alpine

docker run -d -p 6379:6379 \
  redis:7-alpine
```

### 4. Initialize Database

```bash
npm run db:migrate
npm run db:seed      # Optional: add sample data
```

### 5. Start API

```bash
# Development (hot reload)
npm run dev

# Or production
npm run build
npm run start
```

API running on `http://localhost:3000`

---

## Verify Installation

### Health Check

```bash
curl http://localhost:3000/health

# Response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-04-02T15:30:00Z"
}
```

### List Routes

```bash
curl http://localhost:3000

# Response:
{
  "success": true,
  "message": "SneakerCred API",
  "endpoints": {
    "auth": "/api/auth",
    "marketplace": "/api/marketplace",
    "game": "/api/game",
    "sneakers": "/api/sneakers",
    "nft": "/api/nft"
  }
}
```

---

## Test Endpoints

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "username": "testuser"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### Marketplace

```bash
# Get trending sneakers
curl http://localhost:3000/api/marketplace/trending

# Search
curl "http://localhost:3000/api/marketplace/search?q=jordan"
```

### Game

```bash
# Get nearby pieces (no auth required)
curl "http://localhost:3000/api/game/nearby?lat=37.7749&lng=-122.4194&radius=1000"

# Get leaderboard
curl http://localhost:3000/api/game/leaderboard
```

### Sneakers

```bash
# List sneakers
curl http://localhost:3000/api/sneakers?page=1&limit=10

# Get by brand
curl http://localhost:3000/api/sneakers/brand/Nike
```

---

## Development Workflow

### Make Code Changes

Files in `src/` will auto-reload:

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Run Tests

```bash
npm run test
npm run test:integration
```

---

## Database Management

### View Database

```bash
# Using psql
psql postgresql://postgres:postgres@localhost:5432/sneakercred

# Or use pgAdmin web UI
http://localhost:5050
# Email: admin@sneakercred.com
# Password: admin
```

### Reset Database

```bash
npm run db:reset      # Clear everything
npm run db:migrate    # Run migrations again
npm run db:seed       # Add sample data
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process on port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Database Connection Error

Check connection string:

```bash
# Test PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/sneakercred

# Test Redis
redis-cli ping
```

### Module Not Found

```bash
rm -rf node_modules package-lock.json
npm install
```

### JWT Secret Too Short

Error: `JWT_SECRET must be at least 32 characters`

Generate a long secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
JWT_SECRET=<generated-value>
```

---

## Production Setup

### Environment Variables

Update `.env` with production values:

```bash
NODE_ENV=production
DATABASE_URL=<production-postgres-url>
REDIS_URL=<production-redis-url>
JWT_SECRET=<long-random-secret>
API_URL=https://sneakercred.xyz/api
```

### Build and Deploy

```bash
npm run build
npm start

# Or deploy container
docker build -t sneakercred-api:latest .
docker push <registry>/sneakercred-api:latest
```

### Monitor

```bash
# Check health
curl https://sneakercred.xyz/api/health

# View logs
docker logs sneakercred-api

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

## Next Steps

1. ✅ API running and endpoints responding
2. 📝 Implement service layer (queries, business logic)
3. 🗄️ Connect to Python scraper (price data)
4. 🎮 Implement game service (pieces, leaderboard)
5. 🔐 Implement smart contract interaction
6. 🚀 Deploy to production

---

## Quick Commands

```bash
# Development
npm run dev
npm run type-check
npm run lint

# Database
npm run db:migrate
npm run db:seed
npm run db:reset

# Testing
npm run test
npm run test:integration
npm run test:e2e

# Production
npm run build
npm start

# Docker
docker-compose up -d
docker-compose logs -f
docker-compose down
```

---

**Need help?** Check `README.md` for full documentation.
