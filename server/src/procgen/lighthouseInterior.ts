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
    if (entrance) {
      // Mark entrance and carve a small corridor inward so players don't spawn in a sealed nook
      grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };
      // Carve 3x4 corridor going north from the entrance
      const hallW = 3, hallH = 4;
      const hx = Math.max(1, entrance.x - Math.floor(hallW / 2));
      const hy = Math.max(1, entrance.y - hallH);
      for (let yy = hy; yy <= entrance.y; yy++) {
        for (let xx = hx; xx < hx + hallW; xx++) {
          grid[yy][xx] = { type: 'floor', walkable: true };
        }
      }
      // Extend corridor deeper towards the tower center to guarantee connectivity
      for (let yy = Math.max(1, hy - 4); yy >= Math.max(1, cy - Math.floor(radius / 2)); yy--) {
        for (let xx = hx; xx < hx + hallW; xx++) {
          grid[yy][xx] = { type: 'floor', walkable: true };
        }
      }
      // Create a gap in the circular wall directly south if any ring walls remain
      for (let yy = entrance.y; yy >= Math.max(1, entrance.y - 6); yy--) {
        if (grid[yy][entrance.x].type === 'wall') {
          grid[yy][entrance.x] = { type: 'floor', walkable: true };
        }
      }
      // Record a no-build corridor rectangle to keep outbuildings clear
      (grid as any)._corridor = { x1: hx - 1, y1: Math.max(1, hy - 5), x2: hx + hallW, y2: entrance.y + 1 };
    }

    // Stairs
    const stairsDown = level > 0 ? { x: cx - 2, y: cy } : undefined;
    const stairsUp = level < floorsCount - 1 ? { x: cx + 2, y: cy } : undefined;
    if (stairsDown) grid[stairsDown.y][stairsDown.x] = { type: 'stairs_down', walkable: true };
    if (stairsUp) grid[stairsUp.y][stairsUp.x] = { type: 'stairs_up', walkable: true };

    const entities: LighthouseFloor['entities'] = [];
    const containers: LighthouseFloor['containers'] = [];

    // Ground floor outbuildings: boathouse and shed attached to tower exterior (as internal rooms for simplicity)
    if (level === 0) {
      const corridor = (grid as any)._corridor || { x1: 0, y1: 0, x2: 0, y2: 0 };
      const overlapsCorridor = (x: number, y: number, w: number, h: number) => {
        const r1 = { x1: x - 1, y1: y - 1, x2: x + w, y2: y + h };
        const r2 = corridor;
        return !(r1.x2 < r2.x1 || r2.x2 < r1.x1 || r1.y2 < r2.y1 || r2.y2 < r1.y1);
      };
      const placeRect = (w: number, h: number, doorSide: 'bottom' | 'left') => {
        for (let attempts = 0; attempts < 60; attempts++) {
          const x = rng.randomInt(2, width - w - 2);
          const y = rng.randomInt(Math.max(2, cy + Math.floor(radius / 3)), Math.min(height - h - 2, cy + radius - 3));
          // ensure area is inside tower and not overlapping corridor
          let ok = true;
          for (let yy = y - 1; yy <= y + h && ok; yy++) {
            for (let xx = x - 1; xx <= x + w && ok; xx++) {
              if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
              if (yy >= y && yy < y + h && xx >= x && xx < x + w) {
                if (grid[yy][xx].type !== 'floor') ok = false;
              } else {
                if (grid[yy][xx].type === 'wall') ok = false;
              }
            }
          }
          if (!ok) continue;
          if (overlapsCorridor(x, y, w, h)) continue;
          // draw
          for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
              const edge = yy === y || yy === y + h - 1 || xx === x || xx === x + w - 1;
              grid[yy][xx] = edge ? { type: 'wall', walkable: false } : { type: 'floor', walkable: true };
            }
          }
          let dx = x + Math.floor(w / 2), dy = y + h - 1;
          if (doorSide === 'left') { dx = x; dy = y + Math.floor(h / 2); }
          grid[dy][dx] = { type: 'door', walkable: true };
          return { x, y, door: { x: dx, y: dy } };
        }
        return null;
      };
      // Boathouse
      const b = placeRect(6, 4, 'bottom');
      if (b) {
        containers.push({ id: 'boat-chest', position: { x: b.x + 1, y: b.y + 2 }, opened: false, items: [] });
        const boatChance = rarity === 'legendary' ? 0.6 : rarity === 'epic' ? 0.4 : rarity === 'rare' ? 0.25 : 0.1;
        if (rng.random() < boatChance) {
          entities.push({ id: 'boat-1', type: 'boat', name: 'Boat', position: { x: b.x + 3, y: b.y + 2 }, state: { collectible: true } });
        }
      }
      // Shed
      const s = placeRect(4, 4, 'left');
      if (s) containers.push({ id: 'shed-chest', position: { x: s.x + 2, y: s.y + 2 }, opened: false, items: [] });
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
