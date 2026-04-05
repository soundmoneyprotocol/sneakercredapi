/**
 * Marketplace routes
 * GET /api/marketplace/trending - Top trending sneakers
 * GET /api/marketplace/sneaker/:id - Sneaker details + prices
 * GET /api/marketplace/prices - Price history
 * GET /api/marketplace/search - Search sneakers
 */

import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { query } from '../utils/database';
import logger from '../config/logger';
import { analyzeSentiment } from '../utils/sentiment';

const router = Router();

/**
 * Calculate price volatility (standard deviation) over a time period
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
  return Math.sqrt(variance);
}

/**
 * Calculate supply/demand trend
 */
function calculateTrend(values: number[]): { trend: number; direction: 'up' | 'down' | 'stable' } {
  if (values.length < 2) return { trend: 0, direction: 'stable' };

  const first = values[0];
  const last = values[values.length - 1];
  const trend = ((last - first) / first) * 100;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (trend > 5) direction = 'up';
  else if (trend < -5) direction = 'down';

  return { trend: Math.round(trend * 10) / 10, direction };
}

/**
 * GET /api/marketplace/prices
 * Get price history for a product
 * Query params: sku (required), marketplace (optional), timeframe (7d, 30d, 90d)
 */
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const { sku, marketplace, timeframe = '7d' } = req.query;

    if (!sku || typeof sku !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'SKU is required'
      });
    }

    // Validate timeframe
    const validTimeframes = ['7d', '30d', '90d'];
    const tf = (timeframe as string) || '7d';
    if (!validTimeframes.includes(tf)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeframe. Must be 7d, 30d, or 90d'
      });
    }

    // Calculate date range
    const now = new Date();
    const days = parseInt(tf) || 7;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Query sneaker metadata
    const sneakerResult = await query(
      'SELECT id, sku, name, brand, image_url FROM sneakers WHERE LOWER(sku) = LOWER($1)',
      [sku]
    );

    if (sneakerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const sneaker = sneakerResult.rows[0];

    // Build marketplace filter
    let marketplaceFilter = '';
    let params: any[] = [sneaker.id, startDate];

    if (marketplace && typeof marketplace === 'string') {
      marketplaceFilter = ' AND marketplace = $3';
      params.push(marketplace.toUpperCase());
    }

    // Query price history
    const pricesResult = await query(
      `SELECT
        marketplace,
        size,
        condition,
        lowest_ask,
        highest_bid,
        last_sale_price,
        supply,
        demand,
        timestamp
      FROM price_history
      WHERE sneaker_id = $1
        AND timestamp >= $2
        ${marketplaceFilter}
      ORDER BY timestamp ASC`,
      params
    );

    const priceHistory = pricesResult.rows;

    if (priceHistory.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No price data found for this product in the requested timeframe'
      });
    }

    // Group prices by marketplace
    const pricesByMarketplace: Record<string, any[]> = {};
    priceHistory.forEach((row) => {
      if (!pricesByMarketplace[row.marketplace]) {
        pricesByMarketplace[row.marketplace] = [];
      }
      pricesByMarketplace[row.marketplace].push({
        marketplace: row.marketplace,
        lowestAsk: row.lowest_ask,
        highestBid: row.highest_bid,
        lastSalePrice: row.last_sale_price,
        supply: row.supply || 0,
        demand: row.demand || 0,
        timestamp: row.timestamp.toISOString(),
        condition: row.condition,
        size: row.size
      });
    });

    // Calculate summary statistics
    const summary: Record<string, any> = {};
    // Track volatility metrics for sentiment analysis
    const volatilityMetrics: Record<string, number> = {};
    const supplyTrendData: Record<string, any> = {};
    const demandTrendData: Record<string, any> = {};


    Object.entries(pricesByMarketplace).forEach(([mkt, prices]) => {
      const asks = prices
        .map(p => p.lowestAsk)
        .filter((p): p is number => p !== null);
      const bids = prices
        .map(p => p.highestBid)
        .filter((p): p is number => p !== null);
      const sales = prices
        .map(p => p.lastSalePrice)
        .filter((p): p is number => p !== null);
      const supplies = prices.map(p => p.supply);
      const demands = prices.map(p => p.demand);

      const avgAsk = asks.length > 0 ? asks.reduce((a, b) => a + b, 0) / asks.length : null;
      const avgBid = bids.length > 0 ? bids.reduce((a, b) => a + b, 0) / bids.length : null;
      const avgSalePrice = sales.length > 0 ? sales.reduce((a, b) => a + b, 0) / sales.length : null;

      const volatility = asks.length > 1 ? calculateVolatility(asks) : 0;
      const supplyTrend = calculateTrend(supplies);
      const demandTrend = calculateTrend(demands);

      // Track metrics for sentiment analysis
      volatilityMetrics[mkt] = volatility;
      supplyTrendData[mkt] = supplyTrend;
      demandTrendData[mkt] = demandTrend;

      summary[mkt] = {
        avgAsk: avgAsk ? Math.round(avgAsk * 100) / 100 : null,
        avgBid: avgBid ? Math.round(avgBid * 100) / 100 : null,
        avgSalePrice: avgSalePrice ? Math.round(avgSalePrice * 100) / 100 : null,
        minAsk: asks.length > 0 ? Math.min(...asks) : null,
        maxAsk: asks.length > 0 ? Math.max(...asks) : null,
        volatility: Math.round(volatility * 100) / 100,
        supplyTrend: supplyTrend.trend,
        supplyDirection: supplyTrend.direction,
        demandTrend: demandTrend.trend,
        demandDirection: demandTrend.direction,
        dataPoints: prices.length,
        totalSupply: supplies.reduce((a, b) => a + b, 0),
        totalDemand: demands.reduce((a, b) => a + b, 0),
        priceRange: asks.length > 0
          ? `$${Math.min(...asks).toFixed(2)} - $${Math.max(...asks).toFixed(2)}`
          : 'N/A'
      };
    });

    // Generate sentiment analysis
    const sentiment = await analyzeSentiment(summary, supplyTrendData, demandTrendData, volatilityMetrics);

    res.json({
      success: true,
      data: {
        sku: sneaker.sku,
        name: sneaker.name,
        brand: sneaker.brand,
        imageUrl: sneaker.image_url,
        timeframe: tf,
        prices: priceHistory.map(p => ({
          marketplace: p.marketplace,
          lowestAsk: p.lowest_ask,
          highestBid: p.highest_bid,
          lastSalePrice: p.last_sale_price,
          supply: p.supply || 0,
          demand: p.demand || 0,
          timestamp: p.timestamp.toISOString(),
          condition: p.condition,
          size: p.size
        })),
        summary,
        sentiment
      }
    });
  } catch (error) {
    logger.error('Error fetching price data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price data'
    });
  }
});

/**
 * GET /api/marketplace/trending
 * Get top trending sneakers
 */
router.get('/trending', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const topLimit = Math.min(parseInt(limit as string) || 10, 100);

    // Get trending products based on recent demand and price changes
    const result = await query(
      `SELECT
        s.id,
        s.sku,
        s.name,
        s.brand,
        s.image_url,
        COUNT(ph.id) as price_updates,
        AVG(ph.demand) as avg_demand,
        MAX(ph.lowest_ask) as highest_price,
        MIN(ph.lowest_ask) as lowest_price
      FROM sneakers s
      LEFT JOIN price_history ph ON s.id = ph.sneaker_id
      WHERE ph.timestamp >= NOW() - INTERVAL '7 days'
      GROUP BY s.id, s.sku, s.name, s.brand, s.image_url
      ORDER BY avg_demand DESC, price_updates DESC
      LIMIT $1`,
      [topLimit]
    );

    res.json({
      success: true,
      data: {
        trending: result.rows.map(row => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          brand: row.brand,
          imageUrl: row.image_url,
          demand: Math.round(row.avg_demand || 0),
          priceRange: `$${Math.round(row.lowest_price || 0)} - $${Math.round(row.highest_price || 0)}`
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching trending products', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending products'
    });
  }
});

/**
 * GET /api/marketplace/sneaker/:id
 * Get sneaker details with price history
 */
router.get('/sneaker/:sku', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { sku } = req.params;
    const { timeframe = '30d' } = req.query;

    // Query sneaker
    const sneakerResult = await query(
      'SELECT * FROM sneakers WHERE LOWER(sku) = LOWER($1)',
      [sku]
    );

    if (sneakerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sneaker not found'
      });
    }

    const sneaker = sneakerResult.rows[0];

    // Get recent price history
    const days = parseInt(timeframe as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pricesResult = await query(
      `SELECT * FROM price_history
       WHERE sneaker_id = $1 AND timestamp >= $2
       ORDER BY timestamp DESC`,
      [sneaker.id, startDate]
    );

    res.json({
      success: true,
      data: {
        sneaker: {
          id: sneaker.id,
          sku: sneaker.sku,
          name: sneaker.name,
          brand: sneaker.brand,
          model: sneaker.model,
          releaseDate: sneaker.release_date,
          retailPrice: sneaker.retail_price,
          imageUrl: sneaker.image_url,
          description: sneaker.description
        },
        prices: pricesResult.rows.map(row => ({
          marketplace: row.marketplace,
          lowestAsk: row.lowest_ask,
          highestBid: row.highest_bid,
          lastSalePrice: row.last_sale_price,
          supply: row.supply,
          demand: row.demand,
          timestamp: row.timestamp.toISOString(),
          condition: row.condition,
          size: row.size
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching sneaker details', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sneaker details'
    });
  }
});

/**
 * GET /api/marketplace/search
 * Search sneakers by name/SKU
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const searchTerm = `%${q}%`;
    const result = await query(
      `SELECT id, sku, name, brand, image_url
       FROM sneakers
       WHERE LOWER(name) LIKE LOWER($1)
          OR LOWER(sku) LIKE LOWER($1)
          OR LOWER(brand) LIKE LOWER($1)
       LIMIT $2`,
      [searchTerm, Math.min(parseInt(limit as string) || 10, 100)]
    );

    res.json({
      success: true,
      data: {
        results: result.rows.map(row => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          brand: row.brand,
          imageUrl: row.image_url
        })),
        query: q
      }
    });
  } catch (error) {
    logger.error('Error searching sneakers', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search sneakers'
    });
  }
});

/**
 * GET /api/marketplace/by-marketplace
 * Get prices grouped by marketplace
 */
router.get('/by-marketplace', async (req: Request, res: Response) => {
  try {
    const { timeframe = '7d' } = req.query;

    const days = parseInt(timeframe as string) || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await query(
      `SELECT
        marketplace,
        AVG(lowest_ask) as avg_ask,
        AVG(highest_bid) as avg_bid,
        COUNT(*) as price_points,
        SUM(supply) as total_supply,
        SUM(demand) as total_demand
       FROM price_history
       WHERE timestamp >= $1
       GROUP BY marketplace
       ORDER BY total_demand DESC`,
      [startDate]
    );

    res.json({
      success: true,
      data: {
        marketplaces: result.rows.map(row => ({
          name: row.marketplace,
          avgAsk: Math.round((row.avg_ask || 0) * 100) / 100,
          avgBid: Math.round((row.avg_bid || 0) * 100) / 100,
          pricePoints: row.price_points,
          totalSupply: row.total_supply,
          totalDemand: row.total_demand
        })),
        timeframe
      }
    });
  } catch (error) {
    logger.error('Error fetching marketplace stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace data'
    });
  }
});

/**
 * GET /api/marketplace/stats
 * Calculate market statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { timeframe = '30d' } = req.query;

    const days = parseInt(timeframe as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await query(
      `SELECT
        COUNT(DISTINCT sneaker_id) as total_products,
        COUNT(DISTINCT marketplace) as active_marketplaces,
        AVG(lowest_ask) as avg_price,
        MAX(lowest_ask) as highest_price,
        MIN(lowest_ask) as lowest_price,
        SUM(supply) as total_supply,
        SUM(demand) as total_demand,
        COUNT(*) as total_price_points
       FROM price_history
       WHERE timestamp >= $1`,
      [startDate]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        stats: {
          totalProducts: parseInt(stats.total_products),
          activeMarketplaces: parseInt(stats.active_marketplaces),
          avgPrice: Math.round((stats.avg_price || 0) * 100) / 100,
          highestPrice: Math.round((stats.highest_price || 0) * 100) / 100,
          lowestPrice: Math.round((stats.lowest_price || 0) * 100) / 100,
          totalSupply: stats.total_supply,
          totalDemand: stats.total_demand,
          pricePoints: stats.total_price_points,
          timeframe
        }
      }
    });
  } catch (error) {
    logger.error('Error calculating market stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate market statistics'
    });
  }
});

export default router;
