import { DeterministicRNG } from './rng.js';
import { TerrainGenerator, type TerrainData } from './terrain.js';
import { 
  POI_TYPES, 
  type POIType, 
  type Vector2, 
  type Rarity,
  RARITY,
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
  rarity: Rarity;
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
    const spawnVillage = this.placeSpawnVillage(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (spawnVillage) {
      pois.push(spawnVillage);
    }

    // Place special Egg Cavern near spawn point
    const eggCavern = this.placeEggCavern(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (eggCavern) {
      pois.push(eggCavern);
    }

    // Place a Ruined Castle near spawn for early testing
    const nearbyCastle = this.placeRuinedCastle(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (nearbyCastle) {
      pois.push(nearbyCastle);
    }

    // Place a Wizard's Tower near spawn for easy testing
    const nearbyTower = this.placeWizardsTower(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (nearbyTower) {
      pois.push(nearbyTower);
    }

    const poiConfigs = [
      { type: POI_TYPES.VILLAGE, count: 1, biomes: ['grassland', 'savanna', 'shrubland', 'forest'], priority: 1 },
      // Ruined castles should be reachable; avoid 'mountain' which is unwalkable
      { type: POI_TYPES.RUINED_CASTLE, count: 1, biomes: ['hills', 'alpine'], priority: 2 },
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
                seed: poiRng.generateUUID(`seed-${config.type}-${i}`),
                rarity: this.rollRarity(config.type, poiRng)
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

  // Try to place a ruined castle within 12-24 tiles of spawn in hilly/mountain biomes
  private placeRuinedCastle(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    // Keep ruined castles off 'mountain' (unwalkable) to ensure the player can reach them
    const suitableBiomes = ['hills', 'alpine'];
    for (let radius = 12; radius <= 24; radius++) {
      const candidates: Vector2[] = [];
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const x = Math.floor(spawnPoint.x + Math.cos(angle) * radius);
        const y = Math.floor(spawnPoint.y + Math.sin(angle) * radius);
        if (x < 5 || y < 5 || x >= size - 5 || y >= size - 5) continue;
        const biome = terrainData.biomeMap[y][x];
        const height = terrainData.heightMap[y][x];
        if (suitableBiomes.includes(biome) && height > 40) candidates.push({ x, y });
      }
      const spaced = candidates.filter(pos => existing.every(e => distance(pos, e.position) >= minDistance));
      if (spaced.length) {
        const position = rng.randomElement(spaced)!;
        return {
          id: rng.generateUUID('ruined-castle-near-spawn'),
          type: POI_TYPES.RUINED_CASTLE,
          position,
          name: this.generatePOIName(POI_TYPES.RUINED_CASTLE, rng),
          discovered: true, // make it visible for easy testing
          seed: rng.generateUUID('ruined-castle-seed'),
          rarity: this.rollRarity(POI_TYPES.RUINED_CASTLE, rng)
        };
      }
    }
    return null;
  }

  private placeSpawnVillage(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    const suitableBiomes = ['grassland', 'savanna', 'shrubland', 'forest'];
    
    console.log(`[DEBUG] Attempting to place spawn village near spawn point: ${spawnPoint.x}, ${spawnPoint.y}`);
    
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
      
      console.log(`[DEBUG] Radius ${radius}: found ${candidates.length} candidates`);
      
      const spaced = candidates.filter(pos => existing.every(e => distance(pos, e.position) >= minDistance));
      if (spaced.length > 0) {
        const position = rng.randomElement(spaced)!;
        console.log(`[DEBUG] Placed Haven Village at: ${position.x}, ${position.y} (spawn: ${spawnPoint.x}, ${spawnPoint.y})`);
        return {
          id: rng.generateUUID('spawn-village'),
          type: POI_TYPES.VILLAGE,
          position,
          name: 'Haven Village', // Special name for starter village
          discovered: true, // Always discovered
          seed: rng.generateUUID('spawn-village-seed'),
          rarity: RARITY.COMMON
        };
      }
    }
    
    console.log(`[DEBUG] Failed to place spawn village - no suitable candidates found near spawn point`);
    return null; // Fallback - couldn't place near spawn
  }

  private placeEggCavern(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    const suitableBiomes = ['hills', 'mountain', 'taiga', 'forest']; // Cave biomes
    
    console.log(`[DEBUG] Attempting to place Egg Cavern near spawn point: ${spawnPoint.x}, ${spawnPoint.y}`);
    
    // Try to place cavern within 10-20 tiles of spawn point (further than village)
    for (let radius = 10; radius <= 20; radius++) {
      const candidates: Vector2[] = [];
      
      // Search in a ring around spawn point
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const x = Math.floor(spawnPoint.x + Math.cos(angle) * radius);
        const y = Math.floor(spawnPoint.y + Math.sin(angle) * radius);
        
        if (x >= 5 && x < size - 5 && y >= 5 && y < size - 5) {
          const biome = terrainData.biomeMap[y][x];
          const height = terrainData.heightMap[y][x];
          
          if (suitableBiomes.includes(biome) && height > 40 && height < 90) {
            candidates.push({ x, y });
          }
        }
      }
      
      console.log(`[DEBUG] Radius ${radius}: found ${candidates.length} cave candidates`);
      
      const spaced = candidates.filter(pos => existing.every(e => distance(pos, e.position) >= minDistance));
      if (spaced.length > 0) {
        const position = rng.randomElement(spaced)!;
        console.log(`[DEBUG] Placed Egg Cavern at: ${position.x}, ${position.y} (spawn: ${spawnPoint.x}, ${spawnPoint.y})`);
        return {
          id: rng.generateUUID('egg-cavern'),
          type: POI_TYPES.DARK_CAVE,
          position,
          name: 'Egg Cavern', // Special name for starter cave
          discovered: true, // Visible so players can find it easily
          seed: rng.generateUUID('egg-cavern-seed'),
          rarity: RARITY.RARE
        };
      }
    }
    
    console.log(`[DEBUG] Failed to place Egg Cavern - no suitable candidates found near spawn point`);
    return null; // Fallback - couldn't place near spawn
  }

  // Try to place a Wizard's Tower within 10-20 tiles of spawn in walkable biomes
  private placeWizardsTower(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    const suitableBiomes = ['forest', 'hills', 'tundra'];
    for (let radius = 10; radius <= 20; radius++) {
      const candidates: Vector2[] = [];
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const x = Math.floor(spawnPoint.x + Math.cos(angle) * radius);
        const y = Math.floor(spawnPoint.y + Math.sin(angle) * radius);
        if (x < 5 || y < 5 || x >= size - 5 || y >= size - 5) continue;
        const biome = terrainData.biomeMap[y][x];
        const height = terrainData.heightMap[y][x];
        if (suitableBiomes.includes(biome) && height > 35 && height < 85) {
          candidates.push({ x, y });
        }
      }
      const spaced = candidates.filter(pos => existing.every(e => distance(pos, e.position) >= minDistance));
      if (spaced.length) {
        const position = rng.randomElement(spaced)!;
        return {
          id: rng.generateUUID('wizards-tower-near-spawn'),
          type: POI_TYPES.WIZARDS_TOWER,
          position,
          name: this.generatePOIName(POI_TYPES.WIZARDS_TOWER, rng),
          discovered: true,
          seed: rng.generateUUID('wizards-tower-seed'),
          rarity: this.rollRarity(POI_TYPES.WIZARDS_TOWER, rng)
        };
      }
    }
    return null;
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

  private rollRarity(type: POIType, rng: DeterministicRNG): Rarity {
    // Default weights: common 60%, rare 25%, epic 12%, legendary 3%
    // Slightly favor higher rarity for towers
    let wCommon = 0.6, wRare = 0.25, wEpic = 0.12, wLegendary = 0.03;
    if (type === POI_TYPES.WIZARDS_TOWER) {
      wCommon = 0.5; wRare = 0.3; wEpic = 0.15; wLegendary = 0.05;
    }
    const r = rng.random();
    if (r < wCommon) return RARITY.COMMON;
    if (r < wCommon + wRare) return RARITY.RARE;
    if (r < wCommon + wRare + wEpic) return RARITY.EPIC;
    return RARITY.LEGENDARY;
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
