// World generation constants from Dragon Isle
export const WORLD_SIZE = 256;
export const MAX_ELEVATION = 100;
export const SEA_LEVEL = 30;

export const BIOMES = {
  OCEAN: 'ocean',
  BEACH: 'beach',
  COAST: 'coast',
  GRASSLAND: 'grassland',
  FOREST: 'forest',
  SAVANNA: 'savanna',
  SHRUBLAND: 'shrubland',
  HILLS: 'hills',
  MOUNTAIN: 'mountain',
  ALPINE: 'alpine',
  TAIGA: 'taiga',
  TUNDRA: 'tundra',
  DESERT: 'desert'
} as const;

export type Biome = typeof BIOMES[keyof typeof BIOMES];

export const POI_TYPES = {
  VILLAGE: 'village',
  RUINED_CASTLE: 'ruined_castle',
  WIZARDS_TOWER: 'wizards_tower',
  DARK_CAVE: 'dark_cave',
  DRAGON_GROUNDS: 'dragon_grounds',
  LIGHTHOUSE: 'lighthouse',
  ANCIENT_CIRCLE: 'ancient_circle'
} as const;

export type POIType = typeof POI_TYPES[keyof typeof POI_TYPES];

export const RARITY = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
} as const;

export type Rarity = typeof RARITY[keyof typeof RARITY];

export interface Vector2 {
  x: number;
  y: number;
}

export function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export interface POIInterior {
  id: string;
  type: POIType;
  seed: string;
  generatedAt: string;
  layout: Array<Array<{ type: string; walkable: boolean; sprite?: string }>>;
  entrance?: { x: number; y: number }; // Optional entrance coordinates
  entities: Array<{
    id: string;
    type: string;
    name?: string;
    position: Vector2;
    state: any;
  }>;
  containers: Array<{
    id: string;
    position: Vector2;
    opened: boolean;
    items: any[];
  }>;
  cleared: boolean;
}
