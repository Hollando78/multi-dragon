import { DeterministicRNG } from './rng.js';

type Cell = { type: 'wall' | 'floor' | 'entrance' | 'door'; walkable: boolean };

export function generateBuildingInterior(poiId: string, buildingId: string, seed: string, type: string): { layout: Cell[][]; entrance: { x: number; y: number }; entities: any[] } {
  const rng = new DeterministicRNG(`${seed}:${buildingId}:${type}`);
  const size = type === 'market' ? 10 : 8;
  const w = size, h = size;
  const grid: Cell[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ type: 'floor', walkable: true } as Cell)));
  // Walls
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    grid[y][x] = edge ? { type: 'wall', walkable: false } : { type: 'floor', walkable: true };
  }
  // Entrance at south
  const doorX = Math.floor(w / 2);
  const entrance = { x: doorX, y: h - 1 };
  grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };
  grid[h - 2][doorX] = { type: 'floor', walkable: true };

  // Entities based on building type
  const entities: any[] = [];
  if (type === 'tavern') {
    entities.push({ id: 'innkeeper', type: 'innkeeper', name: 'Innkeeper', position: { x: doorX, y: 2 }, state: {} });
  } else if (type === 'blacksmith') {
    entities.push({ id: 'smith', type: 'blacksmith', name: 'Blacksmith', position: { x: 2, y: 2 }, state: {} });
  } else if (type === 'alchemist') {
    entities.push({ id: 'alch', type: 'alchemist', name: 'Alchemist', position: { x: w - 3, y: 2 }, state: {} });
  } else if (type === 'bank') {
    entities.push({ id: 'banker', type: 'banker', name: 'Banker', position: { x: doorX, y: 2 }, state: {} });
  } else if (type === 'library') {
    entities.push({ id: 'librarian', type: 'librarian', name: 'Librarian', position: { x: 2, y: 2 }, state: {} });
  } else if (type === 'market') {
    entities.push({ id: 'trader', type: 'merchant', name: 'Trader', position: { x: doorX, y: 3 }, state: {} });
  } else if (type === 'guardhouse') {
    entities.push({ id: 'captain', type: 'guard', name: 'Captain', position: { x: 2, y: 2 }, state: {} });
  } else if (type === 'temple') {
    entities.push({ id: 'priest', type: 'priest', name: 'Priest', position: { x: doorX, y: 2 }, state: {} });
  }

  return { layout: grid, entrance, entities };
}

