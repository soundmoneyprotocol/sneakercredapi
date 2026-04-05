/**
 * Shared TypeScript types across all services
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
}

export interface Sneaker {
  id: string;
  sku: string;
  name: string;
  brand: string;
  retailPrice: number;
  imageUrl: string;
  nftTokenId?: number;
}

export interface PriceHistory {
  id: string;
  sneakerId: string;
  marketplace: 'GOAT' | 'StockX' | 'Grailed' | 'Depop' | 'eBay';
  lowestAsk?: number;
  highestBid?: number;
  lastSalePrice?: number;
  supply: number;
  demand: number;
  timestamp: Date;
}

export interface GamePiece {
  id: string;
  sneakerId: string;
  partType: 'sole' | 'swoosh' | 'back' | 'body' | 'top' | 'toe';
  latitude: number;
  longitude: number;
  xpReward: number;
}

export interface PlayerProgress {
  id: string;
  userId: string;
  level: number;
  totalXp: number;
  collectedPieces: string[];
  completedSneakers: string[];
  latitude?: number;
  longitude?: number;
}

export interface NFT {
  tokenId: number;
  sneakerId: string;
  contractAddress: string;
  owner: string;
  transactionHash: string;
  createdAt: Date;
}
