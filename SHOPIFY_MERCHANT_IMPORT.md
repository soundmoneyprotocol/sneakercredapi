# Shopify Merchant Import Guide

SoundMoney is a **standalone creator marketplace** that allows Shopify merchants to import and resell their products with **higher payouts (86-89%)**.

## Architecture

```
Shopify Store (Merchant)
        ↓
        ├─ Has products, inventory, pricing
        └─ Wants to reach new customers (collectors)
        
        ↓ [OAuth Authorization]
        
SoundMoney Marketplace (Standalone)
        ↑
        ├─ Import Shopify products
        ├─ Display on creator shop
        ├─ Handle payments via Stripe/Crypto
        └─ Keep 86-89% revenue (vs. 30-50% on Shopify)
```

## Shopify App Configuration

The `/shop/shopify.app.toml` contains credentials for merchant OAuth:

```toml
client_id = "b0cdef30a61d2693817f1568cd6cd98b"
name = "soundmoneyshop"

[access_scopes]
scopes = "write_products"  # Create products in Shopify (future)

[auth]
redirect_urls = [
  "https://personally-aids-framework-mentor.trycloudflare.com/auth/callback",
  "https://personally-aids-framework-mentor.trycloudflare.com/auth/shopify/callback",
  "https://personally-aids-framework-mentor.trycloudflare.com/api/auth/callback"
]
```

## Integration Flow

### 1. Merchant Signs Up on SoundMoney

**URL:** `/seller/register`
- Email/password OR Shopify OAuth
- Create creator profile
- Link wallet (MetaMask/Privy)

### 2. Merchant Connects Shopify Store

**URL:** `/seller/connect-shopify`
- Input: `mystore.myshopify.com`
- Click: "Connect to Shopify"
- Redirects to: `https://mystore.myshopify.com/admin/oauth/authorize?...`
- Shopify asks for permissions
- Merchant approves
- Returns auth code to: `/api/shopify/callback`

### 3. Backend Exchanges Code for Access Token

**Endpoint:** `POST /api/shopify/callback`

```typescript
// Pseudo code
const code = req.query.code;
const accessToken = await shopify.oauth.getAccessToken(code);

// Store in database
await db.shopify_stores.insert({
  user_id: req.user.id,
  shop_name: req.query.shop,
  access_token: accessToken,  // Encrypted
  connected_at: now()
});

// Redirect back to SoundMoney
redirect('/seller/connect-shopify?success=true');
```

### 4. Merchant Syncs Products

**Endpoint:** `POST /api/shopify/sync-products`

```bash
POST /api/shopify/sync-products
{
  "shopName": "mystore.myshopify.com"
}
```

**Backend Process:**
1. Fetch access token from `shopify_stores` table
2. Call Shopify GraphQL API: `products { title, variants, images }`
3. Transform to SoundMoney format
4. Insert into `products` table
5. Create `shopify_inventory_sync` records
6. Return sync status

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 25,
    "skipped": 3,
    "message": "Synced 25 products"
  }
}
```

### 5. Products Live on SoundMoney

- Products appear in merchant's creator shop
- Available in marketplace search
- Tradeable on secondary market
- Merchant earns 86-89% of each sale

## Shopify Scopes

The app requires these Shopify scopes:

| Scope | Purpose | Why |
|-------|---------|-----|
| `read_products` | Fetch product data | Import titles, descriptions, images |
| `read_inventory` | Check stock levels | Track available quantities |
| `read_orders` | View order history | Show sales stats (optional) |
| `write_products` | Create/update products | Publish to Shopify from SoundMoney (future) |

## OAuth Flow Details

### Step 1: Authorization Request

User clicks "Connect to Shopify" → Redirects to:

```
https://mystore.myshopify.com/admin/oauth/authorize
  ?client_id=b0cdef30a61d2693817f1568cd6cd98b
  &scope=read_products,read_inventory,read_orders
  &redirect_uri=https://api.soundmoneyprotocol.xyz/api/shopify/callback
  &state={random_state}
```

### Step 2: Merchant Approves

Shopify shows permission screen:
- "This app wants to read your products"
- "This app wants to read your inventory"
- etc.

Merchant clicks "Install app"

### Step 3: Authorization Code Returned

Shopify redirects back to:

```
https://api.soundmoneyprotocol.xyz/api/shopify/callback
  ?code=abc123def456
  &hmac=xyz789
  &shop=mystore.myshopify.com
  &state={random_state}
```

### Step 4: Exchange Code for Token

Backend (you implement):

```typescript
// POST /api/shopify/callback
const { code, shop, state } = req.query;

// Verify state matches (CSRF protection)
if (state !== req.session.state) {
  return res.status(401).json({ error: 'Invalid state' });
}

// Exchange code for access token
const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code: code
  })
});

const { access_token } = await response.json();

// Save to database
await db.shopify_stores.insert({
  user_id: req.user.id,
  shop_name: shop,
  access_token: encrypt(access_token),
  connected_at: new Date()
});

// Redirect to success page
res.redirect('/seller/connect-shopify?connected=true');
```

### Step 5: Use Access Token

Call Shopify API with access token:

```typescript
const response = await fetch(`https://${shopName}/admin/api/2024-10/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken
  },
  body: JSON.stringify({
    query: `
      {
        products(first: 50) {
          edges {
            node {
              id
              title
              vendor
              images(first: 1) { edges { node { src } } }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                  }
                }
              }
            }
          }
        }
      }
    `
  })
});
```

## Product Transformation

### Shopify Format
```json
{
  "id": "gid://shopify/Product/123456789",
  "title": "Jordan 1 Retro High OG",
  "vendor": "Nike",
  "images": [
    {
      "src": "https://cdn.shopify.com/..."
    }
  ],
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/987654321",
      "title": "Size 10",
      "price": "159.99",
      "sku": "JORDAN-1-10"
    }
  ]
}
```

### SoundMoney Format
```json
{
  "name": "Jordan 1 Retro High OG",
  "brand": "Nike",
  "description": "Classic sneaker from Nike",
  "imageUrl": "https://cdn.shopify.com/...",
  "externalId": "123456789",
  "externalSource": "shopify",
  "price": 15999,  // In cents
  "size": "10",
  "condition": "New",
  "sku": "JORDAN-1-10"
}
```

## Database Schema

### shopify_stores
Tracks connected Shopify stores per SoundMoney creator:

```sql
CREATE TABLE shopify_stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  shop_name VARCHAR(255) NOT NULL,           -- e.g., "mystore.myshopify.com"
  access_token TEXT NOT NULL,                -- Encrypted OAuth token
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, shop_name)
);
```

### shopify_inventory_sync
Tracks sync status for inventory updates:

```sql
CREATE TABLE shopify_inventory_sync (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  shopify_product_id VARCHAR(255) NOT NULL,
  shopify_variant_id VARCHAR(255),
  last_synced TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'pending'  -- pending, synced, failed
);
```

## API Endpoints

### POST /api/shopify/callback
Exchange OAuth code for access token (implement this)

### POST /api/shopify/connect
Connect a store (existing)

### POST /api/shopify/sync-products
Sync products from a connected store (existing)

### GET /api/shopify/stores
List merchant's connected stores (existing)

### DELETE /api/shopify/disconnect
Remove a store connection (existing)

### POST /api/shopify/webhooks/product-updated
Handle Shopify product updates (implement this)

## Revenue Model

### Example: $100 Sale
```
Shopify:
  Sale Price:           $100.00
  Shopify Fee (2.9% + $0.30): -$3.20
  Payment Processing:   -$2.00
  Merchant Keeps:       $94.80 (94.8%)
  
SoundMoney:
  Sale Price:           $100.00
  Platform Fee (11%):   -$11.00
  Payment Processing:   -$2.9 - $0.30
  Merchant Keeps:       $86.00 (86%)
  
BUT:
  - Reach new collector audience
  - Secondary market for resale
  - Escrow protection
  - Authentication badges
  - Governance token rewards
```

So merchants see:
✅ Reach 10K+ collectors on SoundMoney  
✅ Secondary market value appreciation  
✅ Escrow protection for buyers  
✅ Creator community/rewards  
❌ Slightly lower % than Shopify  
❌ Different feature set  

## Security

⚠️ **Access Tokens**
- Encrypt at rest in database
- Never log or expose in errors
- Rotate periodically
- Use environment variables

⚠️ **OAuth**
- Validate `state` parameter (CSRF)
- Use PKCE flow (in production)
- Short-lived tokens with refresh
- Never expose client secret in frontend

⚠️ **API Calls**
- Rate limit: 2 requests/second to Shopify
- Retry on 429 (rate limit)
- Implement backoff

## Implementation Checklist

- [x] Backend Shopify integration created
- [x] Frontend connection page created
- [ ] **OAuth callback endpoint** (`/api/shopify/callback`)
- [ ] **Implement state verification** for CSRF
- [ ] **Encrypt access tokens** in database
- [ ] **Test with dev store** (soundmoneyshop.myshopify.com)
- [ ] **Add webhook validation**
- [ ] **Implement rate limiting**
- [ ] **Add error handling**
- [ ] **Production deployment**

## Testing Checklist

1. **Connect Flow**
   - [ ] Click "Connect to Shopify"
   - [ ] Redirects to Shopify OAuth
   - [ ] Return to SoundMoney
   - [ ] Store saved to database

2. **Sync Products**
   - [ ] Click "Sync Products"
   - [ ] Fetch from Shopify API
   - [ ] Transform correctly
   - [ ] Insert into products table
   - [ ] Show success message

3. **Disconnect**
   - [ ] Click "Disconnect"
   - [ ] Confirm dialog
   - [ ] Remove from database
   - [ ] Products remain but unlinked

## References

- [Shopify OAuth Documentation](https://shopify.dev/docs/admin-api/rest/reference/oauth)
- [Shopify GraphQL API](https://shopify.dev/docs/admin-api/graphql-reference)
- [Shopify Access Scopes](https://shopify.dev/docs/admin-api/rest/reference#api_access_scopes)

## Next Steps

1. **Implement OAuth callback** - Handle code exchange
2. **Test with dev store** - Use soundmoneyshop.myshopify.com
3. **Add webhook handling** - Real-time inventory sync
4. **Production secrets** - Get API secret from Shopify
5. **Deploy and monitor** - Track sync success rate
