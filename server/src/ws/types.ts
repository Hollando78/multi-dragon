export type Vector2 = { x: number; y: number };

export type MovePlayerEvent = {
  x: number;
  y: number;
  t?: number; // client timestamp ms
};

export type PlayerState = {
  userId: string;
  name?: string;
  position: Vector2;
  lastUpdate: number; // server time ms
  chunkId: string;
};

export type ChatMessage = {
  channel: 'local' | 'world' | 'guild' | 'party';
  message: string;
};

export type TradeRequest = {
  tradeId: string;
  targetPlayerId: string;
  items: any[];
};

export type TradeUpdate = {
  tradeId: string;
  status: 'pending' | 'accepted' | 'confirmed' | 'cancelled';
  details?: any;
};

export type TradeOffer = {
  tradeId: string;
  items: any[];
};

export type ChunkState = {
  chunkId: string;
  pois: { id: string; state: any }[];
  npcs: { id: string; state: any }[];
};

export type BreedRequest = {
  poiId: string;
  parentAId: string;
  parentBId: string;
};

export type BreedResult = {
  poiId: string;
  offspring: { id: string; species: string; level: number; stats: any };
  cooldownMs: number;
};
