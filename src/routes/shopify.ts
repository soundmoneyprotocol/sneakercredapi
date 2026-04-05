/**
 * Shopify integration routes
 * Handles product syncing from Shopify stores
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../utils/database';
import { validateShopifyCredentials, getShopifyClient, transformShopifyProduct } from '../utils/shopify';
import logger from '../config/logger';

const router = Router();

interface ShopifyStoreRequest extends Request {
  user?: { id: string };
}

/**
 * POST /api/shopify/connect
 * Connect a Shopify store to a creator account
 */
/**
 * POST /api/shopify/callback
 * Handle Shopify OAuth callback - exchange code for access token
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code, shop, state, hmac } = req.query;

    if (!code || !shop || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing required OAuth parameters'
      });
    }

    // TODO: Verify HMAC signature for security
    // const computedHmac = crypto
    //   .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    //   .update(`code=${code}&host=${host}&shop=${shop}&state=${state}`, 'utf8')
    //   .digest('base64');
    // if (computedHmac !== hmac) {
    //   return res.status(401).json({ success: false, error: 'Invalid HMAC' });
    // }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code as string
      })
    });

    if (!tokenResponse.ok) {
      logger.error('Failed to get access token from Shopify', tokenResponse.status);
      return res.status(401).json({
        success: false,
        error: 'Failed to authorize with Shopify'
      });
    }

    const { access_token } = await tokenResponse.json();

    if (!access_token) {
      return res.status(401).json({
        success: false,
        error: 'No access token received from Shopify'
      });
    }

    // TODO: Get userId from session or JWT token
    // For now, return the credentials to be stored
    res.json({
      success: true,
      data: {
        shop: shop as string,
        accessToken: access_token,
        message: 'Authorization successful. Store access token securely.'
      }
    });

    logger.info(`Shopify OAuth completed for store: ${shop}`);
  } catch (error) {
    logger.error('Error handling Shopify OAuth callback', error);
    res.status(500).json({
      success: false,
      error: 'OAuth callback failed'
    });
  }
});

router.post('/connect', authMiddleware, async (req: ShopifyStoreRequest, res: Response) => {
  try {
    const { shopName, accessToken } = req.body;
    const userId = req.user?.id;

    if (!shopName || !accessToken || !userId) {
      return res.status(400).json({
        success: false,
        error: 'shopName, accessToken, and user authentication required'
      });
    }

    // Validate credentials
    const isValid = await validateShopifyCredentials(accessToken, shopName);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Shopify credentials'
      });
    }

    // Store connection in database
    await query(
      `INSERT INTO shopify_stores (user_id, shop_name, access_token, connected_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, shop_name) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         connected_at = NOW()`,
      [userId, shopName, accessToken]
    );

    res.json({
      success: true,
      message: 'Shopify store connected successfully',
      data: { shopName }
    });
  } catch (error) {
    logger.error('Error connecting Shopify store', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Shopify store'
    });
  }
});

/**
 * POST /api/shopify/sync-products
 * Sync products from connected Shopify store
 */
router.post('/sync-products', authMiddleware, async (req: ShopifyStoreRequest, res: Response) => {
  try {
    const { shopName } = req.body;
    const userId = req.user?.id;

    if (!shopName || !userId) {
      return res.status(400).json({
        success: false,
        error: 'shopName and authentication required'
      });
    }

    // Get store connection
    const storeResult = await query(
      'SELECT access_token FROM shopify_stores WHERE user_id = $1 AND shop_name = $2',
      [userId, shopName]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shopify store not connected'
      });
    }

    const accessToken = storeResult.rows[0].access_token;

    // Get Shopify products
    const client = await getShopifyClient(accessToken, shopName);
    const shopifyProducts = await client.getProducts(100);

    if (!shopifyProducts || shopifyProducts.products.length === 0) {
      return res.json({
        success: true,
        data: {
          synced: 0,
          skipped: 0,
          message: 'No products to sync'
        }
      });
    }

    // Transform and insert products
    let synced = 0;
    let skipped = 0;

    for (const shopifyProduct of shopifyProducts.products) {
      try {
        const transformed = transformShopifyProduct(shopifyProduct);

        // Check if product already exists
        const existingResult = await query(
          'SELECT id FROM products WHERE external_id = $1 AND external_source = $2',
          [shopifyProduct.id, 'shopify']
        );

        if (existingResult.rows.length === 0) {
          // Insert new product
          await query(
            `INSERT INTO products (user_id, name, description, brand, image_url, external_id, external_source, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [userId, transformed.name, transformed.description, transformed.brand, transformed.imageUrl, shopifyProduct.id, 'shopify']
          );

          synced++;
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error(`Error syncing product ${shopifyProduct.id}`, error);
        skipped++;
      }
    }

    res.json({
      success: true,
      data: {
        synced,
        skipped,
        total: shopifyProducts.products.length,
        message: `Synced ${synced} products, skipped ${skipped}`
      }
    });
  } catch (error) {
    logger.error('Error syncing products from Shopify', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync products'
    });
  }
});

/**
 * GET /api/shopify/stores
 * List all connected Shopify stores for user
 */
router.get('/stores', authMiddleware, async (req: ShopifyStoreRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const result = await query(
      `SELECT shop_name, connected_at, (SELECT COUNT(*) FROM products WHERE user_id = $1 AND external_source = 'shopify') as product_count
       FROM shopify_stores
       WHERE user_id = $1
       ORDER BY connected_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        stores: result.rows
      }
    });
  } catch (error) {
    logger.error('Error fetching Shopify stores', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
});

/**
 * DELETE /api/shopify/disconnect
 * Disconnect a Shopify store
 */
router.delete('/disconnect', authMiddleware, async (req: ShopifyStoreRequest, res: Response) => {
  try {
    const { shopName } = req.body;
    const userId = req.user?.id;

    if (!shopName || !userId) {
      return res.status(400).json({
        success: false,
        error: 'shopName and authentication required'
      });
    }

    const result = await query(
      'DELETE FROM shopify_stores WHERE user_id = $1 AND shop_name = $2',
      [userId, shopName]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Store connection not found'
      });
    }

    res.json({
      success: true,
      message: 'Store disconnected successfully'
    });
  } catch (error) {
    logger.error('Error disconnecting Shopify store', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect store'
    });
  }
});

/**
 * POST /api/shopify/webhooks/product-updated
 * Webhook handler for Shopify product updates
 */
router.post('/webhooks/product-updated', async (req: Request, res: Response) => {
  try {
    const { id: shopifyProductId, title, vendor, images } = req.body;

    // Verify webhook signature (implement in production)
    // const hmac = req.get('X-Shopify-Hmac-SHA256');
    // if (!verifyWebhookSignature(req.rawBody, hmac)) {
    //   return res.status(401).json({ success: false, error: 'Invalid signature' });
    // }

    // Update product in database
    await query(
      `UPDATE products
       SET name = $1, brand = $2, image_url = $3, updated_at = NOW()
       WHERE external_id = $4 AND external_source = 'shopify'`,
      [title, vendor || 'Unknown', images?.[0]?.src || null, shopifyProductId]
    );

    res.json({ success: true, message: 'Product updated' });
  } catch (error) {
    logger.error('Error processing Shopify webhook', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    });
  }
});

export default router;
