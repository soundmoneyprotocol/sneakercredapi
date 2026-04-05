-- Add Shopify stores integration table
CREATE TABLE IF NOT EXISTS shopify_stores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  connected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, shop_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_stores_user_id ON shopify_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_shop_name ON shopify_stores(shop_name);

-- Update products table to support external sources
ALTER TABLE IF EXISTS products ADD COLUMN external_id VARCHAR(255);
ALTER TABLE IF EXISTS products ADD COLUMN external_source VARCHAR(50);

-- Create index for external product lookups
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id, external_source);

-- Table for syncing Shopify inventory
CREATE TABLE IF NOT EXISTS shopify_inventory_sync (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_product_id VARCHAR(255) NOT NULL,
  shopify_variant_id VARCHAR(255),
  last_synced TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR(20) DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_shopify_inventory_product_id ON shopify_inventory_sync(product_id);
CREATE INDEX IF NOT EXISTS idx_shopify_inventory_sync_status ON shopify_inventory_sync(sync_status);
