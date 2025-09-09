import { WorldGenerator } from '../procgen/worldGenerator.js';

// Cache for generated worlds
const worldCache = new Map<string, any>();

export function manifestForSeed(seed: string) {
  if (worldCache.has(seed)) {
    return worldCache.get(seed);
  }

  console.log(`Generating world for seed: ${seed}`);
  const generator = new WorldGenerator(seed);
  const world = generator.generate();
  
  const manifest = {
    seed,
    version: 1,
    chunkSize: 64,
    world: {
      size: world.size,
      spawnPoint: world.spawnPoint,
      biomeMap: world.biomeMap,
      heightMap: world.heightMap,
      pois: world.pois.map(poi => ({
        id: poi.id,
        type: poi.type,
        position: poi.position,
        name: poi.name,
        discovered: poi.discovered,
        rarity: poi.rarity,
        unique: poi.unique || false
      })),
      rivers: world.rivers
    }
  };

  // Cache the manifest
  worldCache.set(seed, manifest);
  return manifest;
}
