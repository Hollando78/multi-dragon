import { createNoise2D } from 'simplex-noise';
import { DeterministicRNG } from './rng.js';

export class NoiseGenerator {
  private noise: ReturnType<typeof createNoise2D>;
  private rng: DeterministicRNG;

  constructor(seed: string) {
    this.rng = new DeterministicRNG(seed);
    this.noise = createNoise2D(() => this.rng.random());
  }

  get2D(x: number, y: number, scale = 1, octaves = 1, persistence = 0.5, lacunarity = 2): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  // Correct parameter order to match all call sites: (x, y, scale, octaves)
  fbm(x: number, y: number, scale = 0.01, octaves = 4): number {
    return this.get2D(x, y, scale, octaves, 0.5, 2);
  }

  ridge(x: number, y: number, scale = 0.01, octaves = 4): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise(x * frequency, y * frequency));
      value += n * n * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }

  turbulence(x: number, y: number, scale = 0.01, octaves = 4): number {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += Math.abs(this.noise(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }

  warp(x: number, y: number, warpScale = 0.1, noiseScale = 0.01): number {
    const warpX = this.noise(x * warpScale, y * warpScale) * 10;
    const warpY = this.noise(x * warpScale + 100, y * warpScale + 100) * 10;
    return this.noise((x + warpX) * noiseScale, (y + warpY) * noiseScale);
  }
}
