# Shopify Integration Guide

Enables SoundMoney creators to connect and sync products from their Shopify stores.

## Features

✅ OAuth connection to Shopify stores  
✅ Product syncing (metadata, images, variants)  
✅ Inventory tracking  
✅ Webhook handling for product updates  
✅ Creator dashboard integration  

## Setup

### 1. Environment Variables

Add to `.env`:

```env
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_API_SCOPES=write_products,read_products,write_inventory,read_inventory
SHOPIFY_APP_URL=http://localhost:3000
```

### 2. Get Shopify Credentials

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Create an app
3. Scopes needed:
   - `write_products` - Create/update products
   - `read_products` - Read product data
   - `write_inventory` - Update inventory
   - `read_inventory` - Read inventory levels
   - `write_orders` - Access orders (optional)
   - `read_orders` - Read order data (optional)

### 3. Run Database Migration

```bash
psql $DATABASE_URL < migrations/001_add_shopify_stores.sql
```

## API Endpoints

### Connect Store

**POST** `/api/shopify/connect`

Authenticate and connect a Shopify store to a creator account.

**Request:**
```json
{
  "shopName": "mystore.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shopify store connected successfully",
  "data": {
    "shopName": "mystore.myshopify.com"
  }
}
```

**Errors:**
- `400` - Missing parameters
- `401` - Invalid credentials
- `500` - Server error

---

### Sync Products

**POST** `/api/shopify/sync-products`

Fetch and sync products from a connected Shopify store.

**Request:**
```json
{
  "shopName": "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "synced": 15,
    "skipped": 3,
    "total": 18,
    "message": "Synced 15 products, skipped 3"
  }
}
```

---

### List Connected Stores

**GET** `/api/shopify/stores`

List all Shopify stores connected to the authenticated creator.

**Response:**
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "shop_name": "mystore.myshopify.com",
        "connected_at": "2024-04-05T12:30:00Z",
        "product_count": 15
      }
    ]
  }
}
```

---

### Disconnect Store

**DELETE** `/api/shopify/disconnect`

Remove a connected Shopify store.

**Request:**
```json
{
  "shopName": "mystore.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Store disconnected successfully"
}
```

---

## Product Transformation

Shopify products are transformed to SoundMoney format:

| Shopify | SoundMoney |
|---------|-----------|
| `title` | `name` |
| `bodyHtml` | `description` |
| `vendor` | `brand` |
| `images[0].src` | `imageUrl` |
| `variants[]` | `variants[]` with size extracted |

### Size Extraction

Automatically extracts size from variant titles:
- `"Size 10"` → `"10"`
- `"8.5 US"` → `"8.5"`
- `"Medium"` → `"Medium"`
- `"XL"` → `"XL"`

## Webhook Handling

### Product Updated Webhook

**POST** `/api/shopify/webhooks/product-updated`

Triggered when a Shopify product is updated.

**Payload:**
```json
{
  "id": "123456789",
  "title": "Updated Product Name",
  "vendor": "Nike",
  "images": [
    {
      "src": "https://..."
    }
  ]
}
```

⚠️ **Note**: In production, validate webhook signature with header `X-Shopify-Hmac-SHA256`.

## Database Schema

### shopify_stores

Tracks connected Shopify stores per creator.

```sql
CREATE TABLE shopify_stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  shop_name VARCHAR(255),
  access_token TEXT,
  connected_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, shop_name)
);
```

### shopify_inventory_sync

Tracks which products have synced inventory.

```sql
CREATE TABLE shopify_inventory_sync (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  shopify_product_id VARCHAR(255),
  shopify_variant_id VARCHAR(255),
  last_synced TIMESTAMP,
  sync_status VARCHAR(20)  -- 'pending', 'synced', 'failed'
);
```

## Frontend Integration

The shop needs to add a creator onboarding flow:

### Page: `/seller/connect-shopify`

1. Input: Shopify store URL
2. Redirect to Shopify OAuth flow
3. Receive auth code
4. POST to `/api/shopify/connect`
5. Show connected stores in dashboard
6. Button to "Sync Products"
7. Display sync progress/results

### In `/account/page.tsx`:

Add "Connected Stores" tab:
- List all connected Shopify stores
- Show product count per store
- "Sync Products" button
- "Disconnect" button per store
- Last sync timestamp

## Example Flow

1. **Creator visits** `/seller/connect-shopify`
2. **Clicks** "Connect Shopify Store"
3. **Redirected** to Shopify OAuth consent screen
4. **Approves** permissions
5. **Returns** to SoundMoney with auth token
6. **Token saved** to `shopify_stores` table
7. **Creator clicks** "Sync Products"
8. **Products imported** from Shopify
9. **Available** in creator's SoundMoney shop

## Development Notes

- OAuth flow is simplified; implement full PKCE flow in production
- Webhook signature verification needed before production
- Product updates via webhook are real-time (product-updated only)
- Inventory syncing can be added via `POST /api/shopify/sync-inventory`
- Pricing sync not yet implemented (add as separate endpoint)
- Handle rate limits (Shopify allows 2 req/s)

## Security Considerations

⚠️ **Access tokens are sensitive**
- Store in environment-specific encrypted vault
- Never log full tokens
- Rotate tokens regularly
- Use HTTPS for all Shopify API calls
- Validate webhook signatures

## Future Enhancements

- [ ] Real-time inventory sync via webhooks
- [ ] Price sync from Shopify
- [ ] Order sync (show order history)
- [ ] Multichannel inventory management
- [ ] Bulk product import from CSV
- [ ] Product sync scheduling
- [ ] Variant-specific inventory tracking
