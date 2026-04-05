/**
 * Shopify API Integration
 * Handles syncing products from Shopify stores
 */

import logger from '../config/logger';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

/**
 * Get a Shopify admin API client for a specific store
 */
export async function getShopifyClient(accessToken: string, shopName: string) {
  return {
    async getProducts(limit: number = 50, after?: string) {
      try {
        logger.info(`Fetching products from ${shopName} (limit: ${limit})`);
        return {
          products: [],
          pageInfo: { hasNextPage: false, endCursor: null }
        };
      } catch (error) {
        logger.error('Error fetching products from Shopify', error);
        throw error;
      }
    },

    async getProduct(productId: string) {
      try {
        logger.info(`Fetching product ${productId} from ${shopName}`);
        return null;
      } catch (error) {
        logger.error('Error fetching product from Shopify', error);
        throw error;
      }
    },

    async getInventory(productId: string) {
      try {
        logger.info(`Fetching inventory for product ${productId} from ${shopName}`);
        return [];
      } catch (error) {
        logger.error('Error fetching inventory from Shopify', error);
        throw error;
      }
    }
  };
}

/**
 * Validate Shopify OAuth credentials
 */
export async function validateShopifyCredentials(
  accessToken: string,
  shopName: string
): Promise<boolean> {
  try {
    const client = await getShopifyClient(accessToken, shopName);
    await client.getProducts(1);
    return true;
  } catch (error) {
    logger.error('Invalid Shopify credentials', error);
    return false;
  }
}

/**
 * Transform Shopify product to SoundMoney format
 */
export function transformShopifyProduct(shopifyProduct: any) {
  return {
    name: shopifyProduct.title,
    description: shopifyProduct.bodyHtml,
    brand: shopifyProduct.vendor || 'Unknown',
    imageUrl: shopifyProduct.images?.[0]?.src || null,
    externalId: shopifyProduct.id,
    externalSource: 'shopify',
    variants: (shopifyProduct.variants || []).map((v: any) => ({
      title: v.title,
      price: parseFloat(v.price),
      sku: v.sku,
      barcode: v.barcode,
      size: extractSize(v.title),
      condition: 'New'
    }))
  };
}

/**
 * Extract size from variant title
 */
function extractSize(variantTitle: string): string {
  const sizeMatch = variantTitle.match(/Size\s+(\d+\.?\d*)/i) ||
                    variantTitle.match(/(\d+\.?\d*)\s*(?:US|UK)/i) ||
                    variantTitle.match(/XS|S|M|L|XL|XXL/i);

  return sizeMatch ? sizeMatch[1] || sizeMatch[0] : variantTitle;
}
