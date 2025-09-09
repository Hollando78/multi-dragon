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

export interface BiomeMetadata {
  name: string;
  description: string;
  baseColor: string;
  colorVariance: number; // 0-1, how much color can vary
  elevation: { min: number; max: number };
  moisture: { min: number; max: number };
  temperature: { min: number; max: number };
  walkable: boolean;
  tags: string[];
}

export const BIOME_METADATA: Record<Biome, BiomeMetadata> = {
  ocean: {
    name: 'Ocean',
    description: 'Deep water bodies and seas',
    baseColor: '#1e40af', // deep blue
    colorVariance: 0.15,
    elevation: { min: 0, max: 15 },
    moisture: { min: 0.8, max: 1.0 },
    temperature: { min: 0.0, max: 1.0 },
    walkable: false,
    tags: ['water', 'deep']
  },
  beach: {
    name: 'Beach',
    description: 'Sandy coastal areas and shorelines',
    baseColor: '#fbbf24', // sandy yellow
    colorVariance: 0.25,
    elevation: { min: 15, max: 30 },
    moisture: { min: 0.3, max: 0.7 },
    temperature: { min: 0.2, max: 0.9 },
    walkable: true,
    tags: ['coastal', 'sandy']
  },
  coast: {
    name: 'Coastal Plains',
    description: 'Low-lying fertile land near the sea',
    baseColor: '#84cc16', // coastal green (was incorrectly blue!)
    colorVariance: 0.3,
    elevation: { min: 30, max: 35 },
    moisture: { min: 0.5, max: 0.8 },
    temperature: { min: 0.3, max: 0.8 },
    walkable: true,
    tags: ['coastal', 'fertile', 'lowland']
  },
  grassland: {
    name: 'Grassland',
    description: 'Rolling plains covered with grass',
    baseColor: '#65a30d', // grass green
    colorVariance: 0.4,
    elevation: { min: 35, max: 60 },
    moisture: { min: 0.4, max: 0.7 },
    temperature: { min: 0.3, max: 0.8 },
    walkable: true,
    tags: ['temperate', 'open']
  },
  forest: {
    name: 'Forest',
    description: 'Dense woodlands and temperate forests',
    baseColor: '#166534', // forest green
    colorVariance: 0.35,
    elevation: { min: 35, max: 70 },
    moisture: { min: 0.7, max: 1.0 },
    temperature: { min: 0.2, max: 0.8 },
    walkable: true,
    tags: ['wooded', 'humid']
  },
  savanna: {
    name: 'Savanna',
    description: 'Grasslands with scattered trees',
    baseColor: '#d97706', // warm brown (was gray!)
    colorVariance: 0.4,
    elevation: { min: 35, max: 60 },
    moisture: { min: 0.2, max: 0.4 },
    temperature: { min: 0.6, max: 1.0 },
    walkable: true,
    tags: ['warm', 'dry', 'sparse']
  },
  shrubland: {
    name: 'Shrubland',
    description: 'Semi-arid areas with low vegetation',
    baseColor: '#a3a65a', // olive green
    colorVariance: 0.3,
    elevation: { min: 35, max: 65 },
    moisture: { min: 0.2, max: 0.5 },
    temperature: { min: 0.4, max: 0.9 },
    walkable: true,
    tags: ['dry', 'scrub']
  },
  hills: {
    name: 'Hills',
    description: 'Rolling hills and elevated terrain',
    baseColor: '#a16207', // brown
    colorVariance: 0.25,
    elevation: { min: 60, max: 80 },
    moisture: { min: 0.2, max: 0.8 },
    temperature: { min: 0.1, max: 0.7 },
    walkable: true,
    tags: ['elevated', 'rolling']
  },
  mountain: {
    name: 'Mountain',
    description: 'High peaks and steep slopes',
    baseColor: '#6b7280', // gray
    colorVariance: 0.2,
    elevation: { min: 80, max: 95 },
    moisture: { min: 0.1, max: 0.6 },
    temperature: { min: 0.0, max: 0.4 },
    walkable: false,
    tags: ['high', 'rocky', 'steep']
  },
  alpine: {
    name: 'Alpine',
    description: 'High altitude areas above treeline',
    baseColor: '#e5e7eb', // light gray
    colorVariance: 0.15,
    elevation: { min: 80, max: 100 },
    moisture: { min: 0.3, max: 0.7 },
    temperature: { min: 0.0, max: 0.3 },
    walkable: true,
    tags: ['high', 'cold', 'treeline']
  },
  taiga: {
    name: 'Taiga',
    description: 'Northern coniferous forests',
    baseColor: '#14532d', // dark green
    colorVariance: 0.3,
    elevation: { min: 35, max: 70 },
    moisture: { min: 0.5, max: 0.8 },
    temperature: { min: 0.0, max: 0.3 },
    walkable: true,
    tags: ['cold', 'coniferous', 'northern']
  },
  tundra: {
    name: 'Tundra',
    description: 'Cold, treeless plains',
    baseColor: '#d1d5db', // light gray
    colorVariance: 0.2,
    elevation: { min: 35, max: 80 },
    moisture: { min: 0.3, max: 0.6 },
    temperature: { min: 0.0, max: 0.2 },
    walkable: true,
    tags: ['cold', 'treeless', 'barren']
  },
  desert: {
    name: 'Desert',
    description: 'Hot, dry wastelands',
    baseColor: '#f59e0b', // desert orange (was yellow like beach!)
    colorVariance: 0.35,
    elevation: { min: 35, max: 70 },
    moisture: { min: 0.0, max: 0.3 },
    temperature: { min: 0.7, max: 1.0 },
    walkable: true,
    tags: ['hot', 'arid', 'sandy']
  }
};

export const POI_TYPES = {
  VILLAGE: 'village',
  TOWN: 'town',
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
