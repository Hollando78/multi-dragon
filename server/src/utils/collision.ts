import { manifestForSeed } from '../services/worldManifest.js';

// Unwalkable biomes
const UNWALKABLE_BIOMES = new Set(['ocean', 'mountain']);

// Cache for world manifests to avoid repeated generation
const manifestCache = new Map<string, any>();

export function isWalkable(worldX: number, worldY: number, seed: string): boolean {
  // Get world manifest (cached)
  let manifest = manifestCache.get(seed);
  if (!manifest) {
    manifest = manifestForSeed(seed);
    manifestCache.set(seed, manifest);
  }
  
  if (!manifest.world?.biomeMap) return true; // Allow movement if no world data
  
  const tileX = Math.floor(worldX / 8);
  const tileY = Math.floor(worldY / 8);
  
  if (tileX < 0 || tileY < 0 || tileX >= manifest.world.size || tileY >= manifest.world.size) {
    return false; // Outside world bounds
  }
  
  const biome = manifest.world.biomeMap[tileY] && manifest.world.biomeMap[tileY][tileX];
  return !UNWALKABLE_BIOMES.has(biome);
}

export function validateMovement(
  fromX: number, 
  fromY: number, 
  toX: number, 
  toY: number, 
  seed: string
): { x: number; y: number } {
  // If the destination is walkable, allow the full movement
  if (isWalkable(toX, toY, seed)) {
    return { x: toX, y: toY };
  }
  
  // Try partial movements if diagonal movement is blocked
  if (isWalkable(toX, fromY, seed)) {
    return { x: toX, y: fromY }; // Only horizontal movement
  } else if (isWalkable(fromX, toY, seed)) {
    return { x: fromX, y: toY }; // Only vertical movement
  }
  
  // If no movement is valid, stay at current position
  return { x: fromX, y: fromY };
}