# SneakerCred Unified API

Production-ready Express.js backend serving all SneakerCred ecosystem services.

```
sneakercred.xyz/api
├── /auth       (Authentication & accounts)
├── /marketplace (Price tracking & trending)
├── /game       (AR game data & leaderboards)
├── /sneakers   (Metadata & catalog)
└── /nft        (NFT minting & contracts)
```

## Quick Start (5 Minutes)

### 1. Setup Environment

```bash
cd backend
cp .env.example .env

# Edit .env with your credentials
```

### 2. Start Services

```bash
# Option A: Docker (recommended)
docker-compose up -d

# Option B: Manual setup
npm install
npm run db:migrate
npm run dev
```

### 3. Verify

```bash
curl http://localhost:3000/health
# {"success":true,"status":"healthy"}
```

API running on `http://localhost:3000`

---

## Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Language** | TypeScript 5.1 |
| **Framework** | Express.js 4.18 |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Auth** | JWT (jsonwebtoken) |
| **Validation** | Zod |
| **Logging** | Pino |

### Project Structure

```
src/
├── index.ts           Main server entry
├── config/            Configuration (env, logger, database)
├── middleware/        Express middleware (auth, logging, error)
├── routes/            API endpoints by service
├── services/          Business logic layer
├── types/             TypeScript types
├── utils/             Helper functions
└── models/            Database models
```

---

## API Routes

### Authentication `/api/auth`

```bash
POST   /register              Create account
POST   /login                 Login with email + password
POST   /refresh               Refresh JWT token
GET    /me                    Get current user (requires token)
```

**Example: Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "username": "john_doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Marketplace `/api/marketplace`

```bash
GET    /trending              Top 50 trending sneakers
GET    /sneaker/:id          Detailed sneaker + price history
GET    /prices               Price history for sneaker
GET    /search?q=jordan      Search by name/SKU
GET    /by-marketplace       Prices grouped by marketplace
GET    /stats                Market statistics
```

**Example: Get Trending**
```bash
curl http://localhost:3000/api/marketplace/trending

# Response:
{
  "success": true,
  "data": {
    "sneakers": [
      {
        "id": 42,
        "name": "Jordan 1 Chicago",
        "brand": "Nike",
        "prices": {
          "GOAT": { "ask": 850, "bid": 800 },
          "StockX": { "ask": 875, "bid": 825 }
        }
      }
    ]
  }
}
```

---

### Game `/api/game`

```bash
GET    /nearby               Nearby pieces (requires: lat, lng, radius)
POST   /collect              Collect a piece (requires auth)
GET    /inventory            Player's inventory (requires auth)
GET    /progress             Player level + XP (requires auth)
GET    /leaderboard          Top 100 players
POST   /craft                Mint completed sneaker (requires auth)
```

**Example: Get Nearby Pieces**
```bash
curl "http://localhost:3000/api/game/nearby?lat=37.7749&lng=-122.4194&radius=1000"

# Response:
{
  "success": true,
  "data": {
    "pieces": [
      {
        "id": "piece_123",
        "sneakerId": 42,
        "partType": "sole",
        "latitude": 37.7750,
        "longitude": -122.4195,
        "xpReward": 50,
        "distance_meters": 150
      }
    ]
  }
}
```

---

### Sneakers `/api/sneakers`

```bash
GET    /                    List all sneakers (paginated)
GET    /:id                 Get sneaker details
GET    /sku/:sku            Lookup by SKU
GET    /brand/:brand        Filter by brand
```

---

### NFT `/api/nft` (requires auth)

```bash
POST   /mint                Mint completed sneaker
GET    /token/:id           Get NFT metadata
GET    /balance             User's NFT balance
GET    /inventory           User's NFTs
```

---

## Authentication

All authenticated endpoints require JWT token in header:

```bash
curl http://localhost:3000/api/game/inventory \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Token Details:**
- Algorithm: HS256
- Expiry: 1 hour
- Refresh token: 7 days
- Secret: `JWT_SECRET` from `.env`

---

## Database

### Tables

```
Users
├── id (UUID)
├── email (UNIQUE)
├── password_hash
├── username
├── created_at

Players (extends Users)
├── level
├── total_xp
├── latitude
├── longitude

Sneakers
├── id
├── sku (UNIQUE)
├── name
├── brand
├── retail_price
├── image_url
├── nft_token_id

PriceHistory
├── id
├── sneaker_id (FK)
├── marketplace (GOAT, StockX, Grailed, Depop, eBay)
├── lowest_ask
├── highest_bid
├── supply
├── demand
├── timestamp (indexed)

GamePieces
├── id
├── sneaker_id (FK)
├── part_type (sole, swoosh, back, body, top, toe)
├── latitude
├── longitude
├── xp_reward

CollectedPieces
├── id
├── player_id (FK)
├── piece_id (FK)
├── collected_at

PlayerNFTs
├── id
├── player_id (FK)
├── sneaker_id (FK)
├── token_id (UNIQUE)
├── contract_address
├── transaction_hash
├── created_at
```

### Run Migrations

```bash
npm run db:migrate
npm run db:seed          # Seed with sample data
npm run db:reset         # Clear everything
```

---

## Development

### Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Compile TypeScript
npm run start            # Start production server
npm run test             # Run unit tests
npm run test:integration # Run integration tests
npm run lint             # Check code style
npm run type-check       # TypeScript type checking
```

### Environment Variables

Required variables in `.env`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=min-32-characters
```

See `.env.example` for all variables.

---

## Error Handling

All endpoints return standard error format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `AUTH_REQUIRED` - Missing authorization header (401)
- `INVALID_TOKEN` - Token expired or invalid (401)
- `NOT_FOUND` - Resource doesn't exist (404)
- `VALIDATION_ERROR` - Invalid request body (400)
- `RATE_LIMIT_EXCEEDED` - Too many requests (429)
- `INTERNAL_SERVER_ERROR` - Server error (500)

---

## Testing

```bash
# Unit tests
npm run test

# Integration tests (requires running database)
npm run test:integration

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## Deployment

### Docker

```bash
# Build image
docker build -t sneakercred-api:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  sneakercred-api:latest
```

### Docker Compose

```bash
docker-compose up -d
docker-compose logs -f api
docker-compose down
```

### Cloud Deployment (Railway, Vercel, AWS)

1. Set environment variables in platform
2. Push to GitHub
3. Connect repository to deployment platform
4. Deploy on push

**Example: Railway**
```bash
railway login
railway link
railway up
```

---

## Monitoring

### Health Checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
curl http://localhost:3000/health/cache
```

### Logs

View structured logs:

```bash
# Docker
docker-compose logs -f api

# Local
tail -f logs/api.log
```

### Metrics

Monitor via:
- Response times per endpoint
- Error rates by type
- Database connection pool
- Cache hit/miss rates

---

## Integration Points

### With Python Scraper
- Scraper writes to PostgreSQL
- API queries `sneakers` and `price_history` tables
- No direct API calls; data flows through database

### With Smart Contracts
- API calls `SneakerToken.mint()` via Web3.js
- Stores transaction hash in `player_nfts`

### With Mobile App (React Native)
- Calls `/api/game/*` for game mechanics
- Subscribes to WebSocket for real-time updates

### With Web Frontend
- Calls `/api/marketplace/*` for ticker
- Calls `/api/sneakers/*` for catalog

---

## Performance

### Caching Strategy

- Trending (5m TTL)
- Leaderboard (1m TTL)
- Sneaker metadata (24h TTL)
- User profiles (1h TTL)

### Rate Limiting

- Public: 100 req/min per IP
- Authenticated: 1000 req/min per user
- NFT mint: 1 req/min per user

---

## Next Steps

1. ✅ Initialize project structure
2. 🔄 Implement database models
3. 🔄 Implement service layer (price queries, game logic)
4. 🔄 Complete all route handlers
5. 🔄 Add comprehensive tests
6. 🔄 Deploy to production

---

## Support

See main documentation: `API_MONOREPO_STRUCTURE.md`

For issues, check `/health` endpoint status and logs.
