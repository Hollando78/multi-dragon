import { DeterministicRNG } from './rng.js';
import { TerrainGenerator, type TerrainData } from './terrain.js';
import { 
  POI_TYPES, 
  type POIType, 
  type Vector2, 
  BIOMES, 
  distance 
} from './constants.js';

export interface POI {
  id: string;
  type: POIType;
  position: Vector2;
  name: string;
  discovered: boolean;
  seed: string;
}

export interface WorldSnapshot {
  seed: string;
  size: number;
  heightMap: number[][];
  moistureMap: number[][];
  temperatureMap: number[][];
  biomeMap: string[][];
  rivers: { points: Vector2[]; width: number }[];
  pois: POI[];
  spawnPoint: Vector2;
}

export class WorldGenerator {
  private rng: DeterministicRNG;

  constructor(seed: string) {
    this.rng = new DeterministicRNG(seed);
  }

  generate(): WorldSnapshot {
    const terrainGen = new TerrainGenerator(this.rng.generateUUID('terrain'));
    const terrainData = terrainGen.generate();
    
    const spawnPoint = this.findLandSpawnPoint(terrainData);
    const pois = this.generatePOIs(terrainData, spawnPoint);

    return {
      seed: this.rng.generateUUID('world'),
      size: terrainData.heightMap.length,
      heightMap: terrainData.heightMap,
      moistureMap: terrainData.moistureMap,
      temperatureMap: terrainData.temperatureMap,
      biomeMap: terrainData.biomeMap,
      rivers: terrainData.rivers,
      pois,
      spawnPoint
    };
  }

  private generatePOIs(terrainData: TerrainData, spawnPoint: Vector2): POI[] {
    const pois: POI[] = [];
    const poiRng = this.rng.getSubRNG('pois');
    const size = terrainData.heightMap.length;
    const minDistance = 30;

    // First, place a special starter village near spawn point
    const spawnVillage = this.placeSpawnVillage(terrainData, spawnPoint, poiRng);
    if (spawnVillage) {
      pois.push(spawnVillage);
    }

    const poiConfigs = [
      { type: POI_TYPES.VILLAGE, count: 1, biomes: ['grassland', 'savanna', 'shrubland', 'forest'], priority: 1 },
      { type: POI_TYPES.RUINED_CASTLE, count: 1, biomes: ['hills', 'mountain', 'alpine'], priority: 2 },
      { type: POI_TYPES.WIZARDS_TOWER, count: 1, biomes: ['forest', 'hills', 'tundra'], priority: 3 },
      { type: POI_TYPES.DARK_CAVE, count: 2, biomes: ['mountain', 'hills', 'taiga'], priority: 4 },
      { type: POI_TYPES.DRAGON_GROUNDS, count: 1, biomes: ['mountain', 'alpine'], priority: 5 },
      { type: POI_TYPES.LIGHTHOUSE, count: 1, biomes: ['beach', 'coast'], priority: 6 },
      { type: POI_TYPES.ANCIENT_CIRCLE, count: 1, biomes: ['forest', 'grassland', 'shrubland'], priority: 7 }
    ];

    for (const config of poiConfigs) {
      for (let i = 0; i < config.count; i++) {
        let attempts = 0;
        let placed = false;

        while (!placed && attempts < 100) {
          const x = poiRng.randomInt(20, size - 20);
          const y = poiRng.randomInt(20, size - 20);
          const biome = terrainData.biomeMap[y][x];
          const height = terrainData.heightMap[y][x];

          if (config.biomes.includes(biome) && height > 30) {
            const position = { x, y };
            let tooClose = false;

            for (const existingPoi of pois) {
              if (distance(position, existingPoi.position) < minDistance) {
                tooClose = true;
                break;
              }
            }

            if (!tooClose) {
              pois.push({
                id: poiRng.generateUUID(`poi-${config.type}-${i}`),
                type: config.type,
                position,
                name: this.generatePOIName(config.type, poiRng),
                discovered: config.type === POI_TYPES.VILLAGE,
                seed: poiRng.generateUUID(`seed-${config.type}-${i}`)
              });
              placed = true;
            }
          }

          attempts++;
        }
      }
    }

    return pois;
  }

  private placeSpawnVillage(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG): POI | null {
    const size = terrainData.heightMap.length;
    const suitableBiomes = ['grassland', 'savanna', 'shrubland', 'forest'];
    
    // Try to place village within 3-8 tiles of spawn point
    for (let radius = 3; radius <= 8; radius++) {
      const candidates: Vector2[] = [];
      
      // Search in a ring around spawn point
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = Math.floor(spawnPoint.x + Math.cos(angle) * radius);
        const y = Math.floor(spawnPoint.y + Math.sin(angle) * radius);
        
        if (x >= 5 && x < size - 5 && y >= 5 && y < size - 5) {
          const biome = terrainData.biomeMap[y][x];
          const height = terrainData.heightMap[y][x];
          
          if (suitableBiomes.includes(biome) && height > 35 && height < 80) {
            candidates.push({ x, y });
          }
        }
      }
      
      if (candidates.length > 0) {
        const position = rng.randomElement(candidates)!;
        return {
          id: rng.generateUUID('spawn-village'),
          type: POI_TYPES.VILLAGE,
          position,
          name: 'Haven Village', // Special name for starter village
          discovered: true, // Always discovered
          seed: rng.generateUUID('spawn-village-seed')
        };
      }
    }
    
    return null; // Fallback - couldn't place near spawn
  }

  private generatePOIName(type: POIType, rng: DeterministicRNG): string {
    const names: Record<POIType, string[]> = {
      [POI_TYPES.VILLAGE]: ['Willowbrook', 'Meadowvale', 'Riverholm', 'Greenshire'],
      [POI_TYPES.RUINED_CASTLE]: ['Castle Dreadmoor', 'Fallen Keep', 'Shadowhold Ruins', 'Grimfort'],
      [POI_TYPES.WIZARDS_TOWER]: ['Arcane Spire', 'Mystic Tower', 'Sage\'s Pinnacle', 'Crystal Tower'],
      [POI_TYPES.DARK_CAVE]: ['Shadow Cavern', 'Gloom Hollow', 'Whispering Cave', 'Echo Depths'],
      [POI_TYPES.DRAGON_GROUNDS]: ['Dragon\'s Roost', 'Wyrm Nest', 'Scaled Sanctuary', 'Drake Haven'],
      [POI_TYPES.LIGHTHOUSE]: ['Beacon Point', 'Guardian Light', 'Seafarer\'s Hope', 'Coastal Watch'],
      [POI_TYPES.ANCIENT_CIRCLE]: ['Stone Circle', 'Elder Ring', 'Mystic Stones', 'Ancient Grounds']
    };

    return rng.randomElement(names[type]) || 'Unknown Place';
  }

  private findLandSpawnPoint(terrainData: TerrainData): Vector2 {
    const spawnRng = this.rng.getSubRNG('spawn');
    const size = terrainData.heightMap.length;
    const center = Math.floor(size / 2);
    
    // Preferred biomes for spawning (safe, accessible areas)
    const preferredBiomes = ['grassland', 'forest', 'shrubland', 'savanna', 'coast'];
    const acceptableBiomes = [...preferredBiomes, 'hills', 'beach', 'taiga'];
    
    // Try to find a good spawn point near center, expanding outward
    for (let radius = 10; radius < size / 3; radius += 5) {
      const candidates: Vector2[] = [];
      
      // Search in a ring around the center
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const x = Math.floor(center + Math.cos(angle) * radius);
        const y = Math.floor(center + Math.sin(angle) * radius);
        
        if (x >= 5 && x < size - 5 && y >= 5 && y < size - 5) {
          const biome = terrainData.biomeMap[y][x];
          const height = terrainData.heightMap[y][x];
          
          // Must be on land and not too high/low
          if (acceptableBiomes.includes(biome) && height > 35 && height < 80) {
            // Check surrounding area is also suitable (not surrounded by water/mountains)
            let suitableNeighbors = 0;
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                  const neighborBiome = terrainData.biomeMap[ny][nx];
                  const neighborHeight = terrainData.heightMap[ny][nx];
                  if (acceptableBiomes.includes(neighborBiome) && neighborHeight > 30) {
                    suitableNeighbors++;
                  }
                }
              }
            }
            
            // Require at least 15 out of 25 neighbors to be suitable
            if (suitableNeighbors >= 15) {
              candidates.push({ x, y });
            }
          }
        }
      }
      
      // Prefer candidates in preferred biomes
      const preferredCandidates = candidates.filter(pos => 
        preferredBiomes.includes(terrainData.biomeMap[pos.y][pos.x])
      );
      
      if (preferredCandidates.length > 0) {
        return spawnRng.randomElement(preferredCandidates)!;
      } else if (candidates.length > 0) {
        return spawnRng.randomElement(candidates)!;
      }
    }
    
    // Fallback: find any land tile near center
    for (let radius = 5; radius < size / 2; radius += 5) {
      for (let attempts = 0; attempts < 50; attempts++) {
        const angle = spawnRng.randomFloat(0, Math.PI * 2);
        const x = Math.floor(center + Math.cos(angle) * radius);
        const y = Math.floor(center + Math.sin(angle) * radius);
        
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const biome = terrainData.biomeMap[y][x];
          const height = terrainData.heightMap[y][x];
          
          if (biome !== 'ocean' && height > 30) {
            return { x, y };
          }
        }
      }
    }
    
    // Ultimate fallback: center of map (should usually be land)
    return { x: center, y: center };
  }
}