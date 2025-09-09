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
import { SEA_LEVEL } from './constants.js';

export interface POI {
  id: string;
  type: POIType;
  position: Vector2;
  name: string;
  discovered: boolean;
  seed: string;
  rarity: Rarity;
  unique?: boolean;
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
    const usedNames = new Set<string>();
    const poiRng = this.rng.getSubRNG('pois');
    const size = terrainData.heightMap.length;
    const minDistance = 3;

    // First, place a special starter village near spawn point
    const spawnVillage = this.placeSpawnVillage(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (spawnVillage) {
      usedNames.add(spawnVillage.name);
      pois.push(spawnVillage);
    }

    // Place special Egg Cavern near spawn point
    const eggCavern = this.placeEggCavern(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (eggCavern) {
      usedNames.add(eggCavern.name);
      pois.push(eggCavern);
    }

    // Place a Ruined Castle near spawn for early testing
    const nearbyCastle = this.placeRuinedCastle(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (nearbyCastle) {
      nearbyCastle.name = this.ensureUniqueName(nearbyCastle.name, poiRng, usedNames);
      pois.push(nearbyCastle);
    }

    // Place a Wizard's Tower near spawn for easy testing
    const nearbyTower = this.placeWizardsTower(terrainData, spawnPoint, poiRng, pois, minDistance);
    if (nearbyTower) {
      nearbyTower.name = this.ensureUniqueName(nearbyTower.name, poiRng, usedNames);
      pois.push(nearbyTower);
    }

    const poiConfigs = [
      // Increase non-unique villages to make the world feel more populated
      { type: POI_TYPES.VILLAGE, count: 3, biomes: ['grassland', 'savanna', 'shrubland', 'forest'], priority: 1 },
      // Towns: larger settlements
      { type: POI_TYPES.TOWN, count: 1, biomes: ['grassland', 'forest', 'shrubland', 'hills'], priority: 1 },
      // Ruined castles should be reachable; avoid 'mountain' which is unwalkable
      { type: POI_TYPES.RUINED_CASTLE, count: 1, biomes: ['hills', 'alpine'], priority: 2 },
      { type: POI_TYPES.WIZARDS_TOWER, count: 1, biomes: ['forest', 'hills', 'tundra'], priority: 3 },
      { type: POI_TYPES.DARK_CAVE, count: 2, biomes: ['mountain', 'hills', 'taiga'], priority: 4 },
      { type: POI_TYPES.DRAGON_GROUNDS, count: 0, biomes: ['mountain', 'alpine'], priority: 5 },
      { type: POI_TYPES.LIGHTHOUSE, count: 0, biomes: ['beach', 'coast'], priority: 6 },
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
              const name = this.generateUniqueName(config.type, poiRng, usedNames);
              pois.push({
                id: poiRng.generateUUID(`poi-${config.type}-${i}`),
                type: config.type,
                position,
                name,
                discovered: config.type === POI_TYPES.VILLAGE,
                seed: poiRng.generateUUID(`seed-${config.type}-${i}`),
                rarity: this.rollRarity(config.type, poiRng)
              });
              usedNames.add(name);
              placed = true;
            }
          }

          attempts++;
        }
      }
    }

    // Place a Lighthouse on a prominent headland
    const lighthouse = this.placeLighthouse(terrainData, poiRng, pois, minDistance);
    if (lighthouse) {
      lighthouse.name = this.ensureUniqueName(lighthouse.name, poiRng, usedNames);
      usedNames.add(lighthouse.name);
      pois.push(lighthouse);
    }

    const dragonGrounds = this.placeDragonGrounds(terrainData, poiRng, pois, minDistance);
    if (dragonGrounds) {
      dragonGrounds.name = this.ensureUniqueName(dragonGrounds.name, poiRng, usedNames);
      usedNames.add(dragonGrounds.name);
      pois.push(dragonGrounds);
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
          rarity: RARITY.COMMON,
          unique: true
        };
      }
    }
    
    console.log(`[DEBUG] Failed to place spawn village - no suitable candidates found near spawn point`);
    return null; // Fallback - couldn't place near spawn
  }

  private placeEggCavern(terrainData: TerrainData, spawnPoint: Vector2, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    // Avoid 'mountain' near spawn to keep accessible
    const suitableBiomes = ['hills', 'taiga', 'forest'];
    
    console.log(`[DEBUG] Attempting to place Egg Cavern near spawn point: ${spawnPoint.x}, ${spawnPoint.y}`);
    
    // Try to place cavern within 10-20 tiles of spawn point (further than village)
    for (let radius = 10; radius <= 30; radius++) {
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
          rarity: RARITY.RARE,
          unique: true
        };
      }
    }
    // Relax spacing slightly and extend search
    const relaxed = Math.max(16, minDistance - 10);
    for (let radius = 12; radius <= 36; radius++) {
      const candidates: Vector2[] = [];
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
      const spaced = candidates.filter(pos => existing.every(e => distance(pos, e.position) >= relaxed));
      if (spaced.length > 0) {
        const position = rng.randomElement(spaced)!;
        return {
          id: rng.generateUUID('egg-cavern'),
          type: POI_TYPES.DARK_CAVE,
          position,
          name: 'Egg Cavern',
          discovered: true,
          seed: rng.generateUUID('egg-cavern-seed'),
          rarity: RARITY.RARE
        };
      }
    }
    console.log(`[DEBUG] Failed to place Egg Cavern - no suitable candidates found near spawn point`);
    return null;
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

  private roman(n: number): string {
    const numerals: [number, string][] = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let s = '';
    for (const [val, sym] of numerals) {
      while (n >= val) { s += sym; n -= val; }
    }
    return s;
  }

  private ensureUniqueName(base: string, rng: DeterministicRNG, used: Set<string>): string {
    if (!used.has(base)) return base;
    // Try suffixes with Roman numerals deterministically
    for (let i = 2; i < 50; i++) {
      const candidate = `${base} ${this.roman(i)}`;
      if (!used.has(candidate)) return candidate;
    }
    // Fallback: append a short RNG token
    let token = rng.generateUUID('name').slice(0, 4);
    let cand = `${base} ${token}`;
    while (used.has(cand)) { token = rng.generateUUID('name').slice(0, 4); cand = `${base} ${token}`; }
    return cand;
  }

  private generateUniqueName(type: POIType, rng: DeterministicRNG, used: Set<string>): string {
    // Try picking a base name a few times; if all used, append suffix
    for (let attempts = 0; attempts < 10; attempts++) {
      const base = this.generatePOIName(type, rng);
      if (!used.has(base)) return base;
    }
    // Append suffix to make unique
    const base = this.generatePOIName(type, rng);
    return this.ensureUniqueName(base, rng, used);
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

  // Choose a coastal tile that protrudes into the ocean (headland)
  private placeLighthouse(terrainData: TerrainData, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    let best: { x: number; y: number; score: number } | null = null;
    const biomeMap = terrainData.biomeMap;
    // Scan with a small stride for performance
    const stride = 2;
    for (let y = 2; y < size - 2; y += stride) {
      for (let x = 2; x < size - 2; x += stride) {
        const biome = biomeMap[y][x];
        if (biome !== 'coast' && biome !== 'beach') continue;
        const h = terrainData.heightMap[y][x];
        if (h <= SEA_LEVEL + 1) continue;
        // Count ocean neighbors
        let ocean8 = 0, land8 = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            const b = biomeMap[ny][nx];
            if (b === 'ocean') ocean8++; else land8++;
          }
        }
        // Headland heuristic: many ocean neighbors
        const score = ocean8 * 2 - land8;
        if (ocean8 >= 3 && score > (best?.score ?? -1)) {
          const pos = { x, y };
          if (existing.every(e => distance(pos, e.position) >= minDistance)) {
            best = { x, y, score };
          }
        }
      }
    }
    if (!best) {
      // Fallback: any coast/beach adjacent to ocean
      const candidates: { x: number; y: number }[] = [];
      for (let y = 1; y < size - 1; y += stride) {
        for (let x = 1; x < size - 1; x += stride) {
          const biome = biomeMap[y][x];
          if (biome !== 'coast' && biome !== 'beach') continue;
          let oceanNbr = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (biomeMap[y + dy][x + dx] === 'ocean') oceanNbr++;
            }
          }
          if (oceanNbr >= 2) candidates.push({ x, y });
        }
      }
      if (!candidates.length) return null;
      const pos = rng.randomElement(candidates)!;
      return {
        id: rng.generateUUID('lighthouse-headland'),
        type: POI_TYPES.LIGHTHOUSE,
        position: pos,
        name: this.generatePOIName(POI_TYPES.LIGHTHOUSE, rng),
        discovered: true,
        seed: rng.generateUUID('lighthouse-seed'),
        rarity: this.rollRarity(POI_TYPES.LIGHTHOUSE, rng)
      };
    }
    const position = { x: best.x, y: best.y };
    return {
      id: rng.generateUUID('lighthouse-headland'),
      type: POI_TYPES.LIGHTHOUSE,
      position,
      name: this.generatePOIName(POI_TYPES.LIGHTHOUSE, rng),
      discovered: true,
      seed: rng.generateUUID('lighthouse-seed'),
      rarity: this.rollRarity(POI_TYPES.LIGHTHOUSE, rng)
    };
  }

  // Edge of mountain or deep hills
  private placeDragonGrounds(terrainData: TerrainData, rng: DeterministicRNG, existing: POI[], minDistance: number): POI | null {
    const size = terrainData.heightMap.length;
    const biomeMap = terrainData.biomeMap;
    let best: { x: number; y: number; score: number } | null = null;
    const stride = 2;
    for (let y = 2; y < size - 2; y += stride) {
      for (let x = 2; x < size - 2; x += stride) {
        const biome = biomeMap[y][x];
        const h = terrainData.heightMap[y][x];
        if (biome !== 'mountain' && biome !== 'hills') continue;
        let mountainNbr = 0, hillsNbr = 0, otherNbr = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nb = biomeMap[y + dy][x + dx];
            if (nb === 'mountain') mountainNbr++; else if (nb === 'hills') hillsNbr++; else otherNbr++;
          }
        }
        // Score: edge of mountain (many non-mountain around) or deep hills (many hill neighbors)
        let score = -999;
        if (biome === 'mountain' && otherNbr >= 3 && h > 60) score = otherNbr * 2 + hillsNbr;
        if (biome === 'hills' && hillsNbr >= 5 && h > 40) score = Math.max(score, hillsNbr * 2 - otherNbr);
        if (score <= 0) continue;
        const pos = { x, y };
        if (existing.every(e => distance(pos, e.position) >= minDistance)) {
          if (!best || score > best.score) best = { x, y, score };
        }
      }
    }
    if (!best) return null;
    const position = { x: best.x, y: best.y };
    return {
      id: rng.generateUUID('dragon-grounds'),
      type: POI_TYPES.DRAGON_GROUNDS,
      position,
      name: this.generatePOIName(POI_TYPES.DRAGON_GROUNDS, rng),
      discovered: true,
      seed: rng.generateUUID('dragon-grounds-seed'),
      rarity: this.rollRarity(POI_TYPES.DRAGON_GROUNDS, rng)
    };
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
