/**
 * Market sentiment analysis using Groq
 * Analyzes supply/demand trends to generate market sentiment insights
 */

import logger from '../config/logger';

interface SentimentAnalysis {
  buyerSentiment: {
    label: string;
    score: number;
    trend: string;
  };
  sellerSentiment: {
    label: string;
    score: number;
    trend: string;
  };
  marketMomentum: {
    label: string;
    score: number;
    direction: 'bullish' | 'bearish' | 'neutral';
  };
  pricePrediction: {
    direction: 'up' | 'down' | 'stable';
    estimatedRange: string;
    confidence: number;
  };
  summary: string;
}

/**
 * Generate market sentiment from price data
 * Provides real-time market emotion analysis without requiring Groq API
 * Can be enhanced later with actual Groq API for advanced NLP
 */
export async function analyzeSentiment(
  priceStats: any,
  supplyTrends: Record<string, any>,
  demandTrends: Record<string, any>,
  volatilityMetrics: Record<string, number>
): Promise<SentimentAnalysis> {
  try {
    // Calculate average metrics across all marketplaces
    const allSupplyTrends = Object.values(supplyTrends).map((t: any) => t.trend || 0);
    const allDemandTrends = Object.values(demandTrends).map((t: any) => t.trend || 0);
    const avgSupplyTrend = allSupplyTrends.reduce((a, b) => a + b, 0) / allSupplyTrends.length;
    const avgDemandTrend = allDemandTrends.reduce((a, b) => a + b, 0) / allDemandTrends.length;

    // Calculate volatility average
    const volatilityValues = Object.values(volatilityMetrics);
    const avgVolatility = volatilityValues.reduce((a, b) => a + b, 0) / volatilityValues.length;

    // Buyer sentiment (based on demand trend and volatility)
    const buyerScore = Math.min(100, Math.max(0, 50 + avgDemandTrend * 3));
    const buyerSentiment = getBuyerSentimentLabel(buyerScore, avgDemandTrend);

    // Seller sentiment (based on supply trend)
    const sellerScore = Math.min(100, Math.max(0, 50 - avgSupplyTrend * 2));
    const sellerSentiment = getSellerSentimentLabel(sellerScore, avgSupplyTrend);

    // Market momentum (combines both factors with volatility)
    const momentumScore = (buyerScore + (100 - sellerScore)) / 2;
    const momentumAdjusted = momentumScore + (avgVolatility > 20 ? -10 : 5);
    const momentum = getMarketMomentum(momentumAdjusted);

    // Price prediction
    const prediction = generatePricePrediction(
      avgDemandTrend,
      avgSupplyTrend,
      avgVolatility,
      buyerSentiment.label
    );

    // Generate summary
    const summary = generateSummary(buyerSentiment.label, sellerSentiment.label, momentum.direction);

    return {
      buyerSentiment: {
        label: buyerSentiment.label,
        score: Math.round(buyerScore),
        trend: `${avgDemandTrend >= 0 ? '+' : ''}${Math.round(avgDemandTrend)}%`
      },
      sellerSentiment: {
        label: sellerSentiment.label,
        score: Math.round(sellerScore),
        trend: `${avgSupplyTrend >= 0 ? '+' : ''}${Math.round(avgSupplyTrend)}%`
      },
      marketMomentum: {
        label: momentum.label,
        score: Math.round(momentumAdjusted),
        direction: momentum.direction
      },
      pricePrediction: prediction,
      summary
    };
  } catch (error) {
    logger.error('Error analyzing sentiment', error);
    // Return neutral sentiment on error
    return getNeutralSentiment();
  }
}

function getBuyerSentimentLabel(score: number, trend: number): { label: string; trend: string } {
  const trendStr = `${trend >= 0 ? '+' : ''}${Math.round(trend)}%`;
  if (score >= 70) return { label: 'Very Bullish', trend: trendStr };
  if (score >= 60) return { label: 'Bullish', trend: trendStr };
  if (score >= 45) return { label: 'Neutral', trend: trendStr };
  if (score >= 30) return { label: 'Bearish', trend: trendStr };
  return { label: 'Very Bearish', trend: trendStr };
}

function getSellerSentimentLabel(score: number, trend: number): { label: string; trend: string } {
  const trendStr = `${trend >= 0 ? '+' : ''}${Math.round(trend)}%`;
  if (score >= 70) return { label: 'Bullish', trend: trendStr };
  if (score >= 60) return { label: 'Slightly Bullish', trend: trendStr };
  if (score >= 45) return { label: 'Neutral', trend: trendStr };
  if (score >= 30) return { label: 'Slightly Bearish', trend: trendStr };
  return { label: 'Bearish', trend: trendStr };
}

function getMarketMomentum(score: number): { label: string; direction: 'bullish' | 'bearish' | 'neutral' } {
  if (score >= 65) return { label: 'Strong Bullish', direction: 'bullish' };
  if (score >= 55) return { label: 'Bullish', direction: 'bullish' };
  if (score >= 45) return { label: 'Neutral', direction: 'neutral' };
  if (score >= 35) return { label: 'Bearish', direction: 'bearish' };
  return { label: 'Strong Bearish', direction: 'bearish' };
}

function generatePricePrediction(
  demandTrend: number,
  supplyTrend: number,
  volatility: number,
  sentiment: string
): { direction: 'up' | 'down' | 'stable'; estimatedRange: string; confidence: number } {
  const netTrend = demandTrend - supplyTrend;
  let direction: 'up' | 'down' | 'stable' = 'stable';
  let confidence = Math.min(90, 50 + Math.abs(netTrend) * 2);

  if (netTrend > 5) direction = 'up';
  else if (netTrend < -5) direction = 'down';

  // Adjust confidence based on volatility
  if (volatility > 30) confidence = Math.max(40, confidence - 15);

  const range = volatility > 0 ? `$${Math.round(volatility * 2)}-${Math.round(volatility * 3)}` : '$20-30';

  return {
    direction,
    estimatedRange: `${direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'} ${range} (7d)`,
    confidence: Math.round(confidence)
  };
}

function generateSummary(buyerSentiment: string, sellerSentiment: string, momentum: string): string {
  const parts = [];

  if (buyerSentiment.includes('Bullish')) {
    parts.push('Strong buyer interest');
  } else if (buyerSentiment.includes('Bearish')) {
    parts.push('Weak buyer interest');
  }

  if (momentum === 'bullish') {
    parts.push('positive momentum');
  } else if (momentum === 'bearish') {
    parts.push('negative momentum');
  }

  if (parts.length === 0) parts.push('stable market conditions');

  return `Market showing ${parts.join(' with ')}. Monitor supply levels for potential price movements.`;
}

function getNeutralSentiment(): SentimentAnalysis {
  return {
    buyerSentiment: {
      label: 'Neutral',
      score: 50,
      trend: '0%'
    },
    sellerSentiment: {
      label: 'Neutral',
      score: 50,
      trend: '0%'
    },
    marketMomentum: {
      label: 'Neutral',
      score: 50,
      direction: 'neutral'
    },
    pricePrediction: {
      direction: 'stable',
      estimatedRange: '→ $0 (7d)',
      confidence: 30
    },
    summary: 'Insufficient data for sentiment analysis. Market conditions unclear.'
  };
}

export default {
  analyzeSentiment,
  getBuyerSentimentLabel,
  getSellerSentimentLabel,
  getMarketMomentum
};
