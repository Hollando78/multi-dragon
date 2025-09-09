import seedrandom from 'seedrandom';

export class DeterministicRNG {
  private rng: seedrandom.PRNG;
  private masterSeed: string;
  private subSeeds: Map<string, seedrandom.PRNG>;

  constructor(masterSeed: string) {
    this.masterSeed = masterSeed;
    this.rng = seedrandom(masterSeed);
    this.subSeeds = new Map();
  }

  getSubRNG(scope: string): DeterministicRNG {
    const subSeed = `${this.masterSeed}:${scope}`;
    return new DeterministicRNG(subSeed);
  }

  private getOrCreateSubSeed(scope: string): seedrandom.PRNG {
    if (!this.subSeeds.has(scope)) {
      const subSeed = `${this.masterSeed}:${scope}`;
      this.subSeeds.set(scope, seedrandom(subSeed));
    }
    return this.subSeeds.get(scope)!;
  }

  random(scope?: string): number {
    if (scope) {
      return this.getOrCreateSubSeed(scope)();
    }
    return this.rng();
  }

  randomInt(min: number, max: number, scope?: string): number {
    const rand = this.random(scope);
    return Math.floor(rand * (max - min + 1)) + min;
  }

  randomFloat(min: number, max: number, scope?: string): number {
    const rand = this.random(scope);
    return rand * (max - min) + min;
  }

  randomBoolean(probability = 0.5, scope?: string): boolean {
    return this.random(scope) < probability;
  }

  randomElement<T>(array: T[], scope?: string): T | undefined {
    if (array.length === 0) return undefined;
    const index = this.randomInt(0, array.length - 1, scope);
    return array[index];
  }

  shuffle<T>(array: T[], scope?: string): T[] {
    const result = [...array];
    const rng = scope ? this.getOrCreateSubSeed(scope) : this.rng;
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }

  weightedRandom<T>(items: Array<{ item: T; weight: number }>, scope?: string): T | undefined {
    if (items.length === 0) return undefined;
    
    const totalWeight = items.reduce((sum, { weight }) => sum + weight, 0);
    let random = this.randomFloat(0, totalWeight, scope);
    
    for (const { item, weight } of items) {
      random -= weight;
      if (random <= 0) return item;
    }
    
    return items[items.length - 1].item;
  }

  gaussian(mean = 0, stdDev = 1, scope?: string): number {
    const u1 = this.random(scope);
    const u2 = this.random(scope);
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  generateUUID(scope?: string): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4';
      } else if (i === 19) {
        uuid += hex[this.randomInt(8, 11, scope)];
      } else {
        uuid += hex[this.randomInt(0, 15, scope)];
      }
    }
    
    return uuid;
  }

  noise2D(x: number, y: number, scope?: string): number {
    const rng = scope ? this.getOrCreateSubSeed(scope) : this.rng;
    const key = `${Math.floor(x)},${Math.floor(y)}`;
    const seed = `${this.masterSeed}:noise:${key}`;
    const noiseRng = seedrandom(seed);
    return noiseRng() * 2 - 1;
  }
}

export function createSeedFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function generateRandomSeed(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let seed = '';
  for (let i = 0; i < 12; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return seed;
}