import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';
import type { Rarity } from './constants.js';

type CellType = 'wall' | 'floor' | 'entrance' | 'door' | 'stairs_up' | 'stairs_down';
type Cell = { type: CellType; walkable: boolean; sprite?: string };

interface LighthouseFloor {
  layout: Cell[][];
  entities: Array<{ id: string; type: string; name?: string; position: { x: number; y: number }; state: any }>;
  containers: Array<{ id: string; position: { x: number; y: number }; opened: boolean; items: any[] }>;
  entrance?: { x: number; y: number };
  stairsUp?: { x: number; y: number };
  stairsDown?: { x: number; y: number };
}

// Generate a multi-floor Lighthouse: circular tower; ground floor has outbuildings (boathouse, shed).
export function generateLighthouse(poiId: string, seed: string, rarity: Rarity = 'common'): POIInterior {
  const rng = new DeterministicRNG(seed);
  const floorsCount = rarity === 'legendary' ? 6 : rarity === 'epic' ? 5 : rarity === 'rare' ? 4 : 3;
  const scale = rarity === 'legendary' ? 1.3 : rarity === 'epic' ? 1.2 : rarity === 'rare' ? 1.1 : 1.0;
  const width = Math.max(24, Math.round(28 * scale));
  const height = Math.max(24, Math.round(28 * scale));

  const floors: LighthouseFloor[] = [];

  const genFloor = (level: number): LighthouseFloor => {
    const grid: Cell[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ type: 'floor', walkable: true } as Cell))
    );
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const radius = Math.min(cx, cy) - 3;

    // Tower circular wall
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > radius + 0.6) {
          grid[y][x] = { type: 'wall', walkable: false };
        } else if (Math.abs(d - radius) < 0.9) {
          grid[y][x] = { type: 'wall', walkable: false };
        } else {
          grid[y][x] = { type: 'floor', walkable: true };
        }
      }
    }

    // Entrance at south
    const entrance = level === 0 ? { x: cx, y: height - (cy - radius) - 2 } : undefined;
    if (entrance) grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };

    // Stairs
    const stairsDown = level > 0 ? { x: cx - 2, y: cy } : undefined;
    const stairsUp = level < floorsCount - 1 ? { x: cx + 2, y: cy } : undefined;
    if (stairsDown) grid[stairsDown.y][stairsDown.x] = { type: 'stairs_down', walkable: true };
    if (stairsUp) grid[stairsUp.y][stairsUp.x] = { type: 'stairs_up', walkable: true };

    const entities: LighthouseFloor['entities'] = [];
    const containers: LighthouseFloor['containers'] = [];

    // Ground floor outbuildings: boathouse and shed attached to tower exterior (as internal rooms for simplicity)
    if (level === 0) {
      // Boathouse
      const bw = 6, bh = 4;
      const bx = Math.max(2, cx - Math.floor(bw / 2));
      const by = Math.min(height - bh - 2, cy + radius - 3);
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const edge = y === by || y === by + bh - 1 || x === bx || x === bx + bw - 1;
          grid[y][x] = edge ? { type: 'wall', walkable: false } : { type: 'floor', walkable: true };
        }
      }
      grid[by + bh - 1][bx + Math.floor(bw / 2)] = { type: 'door', walkable: true };

      // Shed
      const sw = 4, sh = 4;
      const sx = Math.min(width - sw - 2, cx + radius - 3);
      const sy = Math.max(2, cy - Math.floor(sh / 2));
      for (let y = sy; y < sy + sh; y++) {
        for (let x = sx; x < sx + sw; x++) {
          const edge = y === sy || y === sy + sh - 1 || x === sx || x === sx + sw - 1;
          grid[y][x] = edge ? { type: 'wall', walkable: false } : { type: 'floor', walkable: true };
        }
      }
      grid[sy + Math.floor(sh / 2)][sx] = { type: 'door', walkable: true };

      // Containers in outbuildings
      containers.push({ id: 'boat-chest', position: { x: bx + 1, y: by + 2 }, opened: false, items: [] });
      containers.push({ id: 'shed-chest', position: { x: sx + 2, y: sy + 2 }, opened: false, items: [] });

      // Boat collectible chance increases with rarity
      const boatChance = rarity === 'legendary' ? 0.6 : rarity === 'epic' ? 0.4 : rarity === 'rare' ? 0.25 : 0.1;
      if (rng.random() < boatChance) {
        entities.push({ id: 'boat-1', type: 'boat', name: 'Boat', position: { x: bx + Math.floor(bw / 2), y: by + Math.floor(bh / 2) }, state: { collectible: true } });
      }
    }

    // Keeper on top floor
    if (level === floorsCount - 1) {
      entities.push({ id: 'keeper', type: 'keeper', name: 'Lighthouse Keeper', position: { x: cx, y: cy - 1 }, state: {} });
    }

    return { layout: grid, entities, containers, entrance, stairsUp, stairsDown };
  };

  for (let f = 0; f < floorsCount; f++) floors.push(genFloor(f));
  const f0 = floors[0];
  const interior: POIInterior & { floors?: LighthouseFloor[]; currentFloor?: number } = {
    id: poiId,
    type: 'lighthouse' as any,
    seed,
    generatedAt: new Date().toISOString(),
    layout: f0.layout,
    entrance: f0.entrance,
    entities: f0.entities,
    containers: f0.containers,
    cleared: false,
    floors,
    currentFloor: 0,
  };

  return interior as POIInterior;
}

