import { 
  DeterministicRNG
} from './rng.js';
import { NoiseGenerator } from './noise.js';
import { 
  WORLD_SIZE, 
  MAX_ELEVATION, 
  SEA_LEVEL,
  BIOMES,
  type Biome,
  type Vector2,
  clamp,
  smoothstep
} from './constants.js';

export interface TerrainData {
  heightMap: number[][];
  moistureMap: number[][];
  temperatureMap: number[][];
  biomeMap: Biome[][];
  rivers: { points: Vector2[]; width: number }[];
}

export class TerrainGenerator {
  private rng: DeterministicRNG;
  private size: number;
  private heightNoise: NoiseGenerator;
  private moistureNoise: NoiseGenerator;
  private tempNoise: NoiseGenerator;
  private shapeNoise: NoiseGenerator;
  private windDir: { x: number; y: number };
  private shapeAngle: number;
  private shapeScaleX: number;
  private shapeScaleY: number;
  private shapeHarmonics: number;
  private shapeHarmonicAmp: number;
  private coastNoiseAmp: number;
  private coastNoiseFreq: number;
  private latShift: number;
  private latAmp: number;

  constructor(seed: string, size = WORLD_SIZE) {
    this.rng = new DeterministicRNG(seed);
    this.size = size;
    this.heightNoise = new NoiseGenerator(this.rng.getSubRNG('height').generateUUID());
    this.moistureNoise = new NoiseGenerator(this.rng.getSubRNG('moisture').generateUUID());
    this.tempNoise = new NoiseGenerator(this.rng.getSubRNG('temperature').generateUUID());
    this.shapeNoise = new NoiseGenerator(this.rng.getSubRNG('shape').generateUUID());
    
    // Deterministic prevailing wind direction (unit vector)
    const angle = (this.rng.getSubRNG('climate').randomFloat(0, Math.PI * 2));
    this.windDir = { x: Math.cos(angle), y: Math.sin(angle) };
    
    // Seeded non-circular island shape params
    const shapeRng = this.rng.getSubRNG('island-shape');
    this.shapeAngle = shapeRng.randomFloat(0, Math.PI * 2);
    this.shapeScaleX = shapeRng.randomFloat(0.75, 1.35);
    this.shapeScaleY = shapeRng.randomFloat(0.75, 1.35);
    this.shapeHarmonics = Math.floor(shapeRng.randomFloat(2, 7));
    this.shapeHarmonicAmp = shapeRng.randomFloat(0.06, 0.18);
    this.coastNoiseAmp = shapeRng.randomFloat(0.08, 0.22);
    this.coastNoiseFreq = shapeRng.randomFloat(0.0035, 0.01);
    
    // Seeded latitude band shift and amplitude to reduce cold bias
    const latRng = this.rng.getSubRNG('latitude');
    this.latShift = latRng.randomFloat(-0.25, 0.25);
    this.latAmp = latRng.randomFloat(0.28, 0.42);
  }

  generate(): TerrainData {
    const heightMap = this.generateHeightMap();
    let moistureMap = this.generateMoistureMap(heightMap);
    
    // Simple river generation (simplified from Dragon Isle)
    const rivers = this.generateSimpleRivers(heightMap);
    moistureMap = this.applyRiverMoisture(moistureMap, rivers);
    
    const temperatureMap = this.generateTemperatureMap(heightMap);
    const biomeMap = this.generateBiomeMap(heightMap, moistureMap, temperatureMap);

    return {
      heightMap,
      moistureMap,
      temperatureMap,
      biomeMap,
      rivers
    };
  }

  private generateHeightMap(): number[][] {
    const heightMap: number[][] = [];
    const center = { x: this.size / 2, y: this.size / 2 };
    const maxDist = Math.sqrt(center.x * center.x + center.y * center.y);

    for (let y = 0; y < this.size; y++) {
      heightMap[y] = [];
      for (let x = 0; x < this.size; x++) {
        // Distance from center
        const dx = x - center.x;
        const dy = y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

        // Island falloff with shape variations
        let falloff = 1 - smoothstep(0.3, 0.8, dist);
        
        // Add shape noise for non-circular islands
        const shapeNoise = this.shapeNoise.fbm(x, y, 0.01, 3);
        falloff += shapeNoise * this.shapeHarmonicAmp;

        // Base terrain noise
        const baseNoise = this.heightNoise.fbm(x, y, 0.005, 6);
        const ridgeNoise = this.heightNoise.ridge(x, y, 0.01, 4) * 0.3;
        
        let height = (baseNoise + ridgeNoise) * falloff;
        height = clamp(height * MAX_ELEVATION, 0, MAX_ELEVATION);

        heightMap[y][x] = height;
      }
    }

    return heightMap;
  }

  private generateMoistureMap(heightMap: number[][]): number[][] {
    const moistureMap: number[][] = [];

    for (let y = 0; y < this.size; y++) {
      moistureMap[y] = [];
      for (let x = 0; x < this.size; x++) {
        const height = heightMap[y][x];
        
        // Base moisture from noise
        let moisture = this.moistureNoise.fbm(x, y, 0.008, 4);
        
        // Ocean adds moisture
        if (height <= SEA_LEVEL) {
          moisture += 0.5;
        }
        
        // Higher elevations are drier
        moisture -= (height / MAX_ELEVATION) * 0.3;
        
        moisture = clamp(moisture, 0, 1);
        moistureMap[y][x] = moisture;
      }
    }

    return moistureMap;
  }

  private generateTemperatureMap(heightMap: number[][]): number[][] {
    const temperatureMap: number[][] = [];

    for (let y = 0; y < this.size; y++) {
      temperatureMap[y] = [];
      for (let x = 0; x < this.size; x++) {
        const height = heightMap[y][x];
        
        // Latitude-based temperature (distance from center)
        const latFactor = Math.abs(y - this.size / 2) / (this.size / 2);
        let temperature = 1 - (latFactor * this.latAmp + this.latShift);
        
        // Elevation cooling
        temperature -= (height / MAX_ELEVATION) * 0.4;
        
        // Add some noise
        temperature += this.tempNoise.fbm(x, y, 0.01, 3) * 0.2;
        
        temperature = clamp(temperature, 0, 1);
        temperatureMap[y][x] = temperature;
      }
    }

    return temperatureMap;
  }

  private generateBiomeMap(heightMap: number[][], moistureMap: number[][], temperatureMap: number[][]): Biome[][] {
    const biomeMap: Biome[][] = [];

    for (let y = 0; y < this.size; y++) {
      biomeMap[y] = [];
      for (let x = 0; x < this.size; x++) {
        const height = heightMap[y][x];
        const moisture = moistureMap[y][x];
        const temperature = temperatureMap[y][x];

        let biome: Biome;

        if (height <= SEA_LEVEL * 0.5) {
          biome = BIOMES.OCEAN;
        } else if (height <= SEA_LEVEL) {
          biome = BIOMES.BEACH;
        } else if (height <= SEA_LEVEL + 5) {
          biome = BIOMES.COAST;
        } else if (height >= MAX_ELEVATION * 0.8) {
          biome = temperature > 0.3 ? BIOMES.ALPINE : BIOMES.TUNDRA;
        } else if (height >= MAX_ELEVATION * 0.6) {
          biome = BIOMES.MOUNTAIN;
        } else if (height >= MAX_ELEVATION * 0.4) {
          biome = BIOMES.HILLS;
        } else {
          // Lowland biomes based on temperature and moisture
          if (temperature < 0.2) {
            biome = moisture > 0.5 ? BIOMES.TAIGA : BIOMES.TUNDRA;
          } else if (temperature > 0.8) {
            biome = moisture > 0.3 ? BIOMES.SAVANNA : BIOMES.DESERT;
          } else {
            if (moisture > 0.7) {
              biome = BIOMES.FOREST;
            } else if (moisture > 0.4) {
              biome = BIOMES.GRASSLAND;
            } else {
              biome = BIOMES.SHRUBLAND;
            }
          }
        }

        biomeMap[y][x] = biome;
      }
    }

    return biomeMap;
  }

  private generateSimpleRivers(heightMap: number[][]): { points: Vector2[]; width: number }[] {
    // Simplified river generation - just a few random rivers
    const rivers: { points: Vector2[]; width: number }[] = [];
    const riverRng = this.rng.getSubRNG('rivers');
    
    for (let i = 0; i < 3; i++) {
      const startX = riverRng.randomInt(20, this.size - 20);
      const startY = riverRng.randomInt(20, this.size - 20);
      
      const points: Vector2[] = [];
      let x = startX;
      let y = startY;
      
      // Trace downhill for a bit
      for (let step = 0; step < 50; step++) {
        points.push({ x, y });
        
        // Find steepest descent
        let bestX = x, bestY = y;
        let bestHeight = heightMap[y][x];
        
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
              if (heightMap[ny][nx] < bestHeight) {
                bestHeight = heightMap[ny][nx];
                bestX = nx;
                bestY = ny;
              }
            }
          }
        }
        
        if (bestX === x && bestY === y) break; // No downhill
        if (bestHeight <= SEA_LEVEL) break; // Reached water
        
        x = bestX;
        y = bestY;
      }
      
      if (points.length > 5) {
        rivers.push({ points, width: riverRng.randomInt(1, 3) });
      }
    }
    
    return rivers;
  }

  private applyRiverMoisture(moistureMap: number[][], rivers: { points: Vector2[]; width: number }[]): number[][] {
    const result = moistureMap.map(row => [...row]);
    
    for (const river of rivers) {
      for (const point of river.points) {
        const radius = river.width + 2;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = Math.floor(point.x + dx);
            const y = Math.floor(point.y + dy);
            
            if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= radius) {
                const moistureBoost = (1 - dist / radius) * 0.3;
                result[y][x] = Math.min(1, result[y][x] + moistureBoost);
              }
            }
          }
        }
      }
    }
    
    return result;
  }
}