import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';
import type { Rarity } from './constants.js';

type CellType = 'wall' | 'floor' | 'entrance' | 'door' | 'stairs_up' | 'stairs_down';
type Cell = { type: CellType; walkable: boolean; sprite?: string };

interface TowerFloor {
  layout: Cell[][];
  entities: Array<{ id: string; type: string; position: { x: number; y: number }; state: any }>;
  containers: Array<{ id: string; position: { x: number; y: number }; opened: boolean; items: any[] }>;
  entrance?: { x: number; y: number };
  stairsUp?: { x: number; y: number };
  stairsDown?: { x: number; y: number };
}

// Generate a multi-floor Wizard's Tower interior. Floors are stacked; stairs connect between them.
export function generateWizardsTower(poiId: string, seed: string, rarity: Rarity = 'common'): POIInterior {
  const rng = new DeterministicRNG(seed);
  const floorsCount = rarity === 'legendary' ? 6 : rarity === 'epic' ? 5 : rarity === 'rare' ? 4 : 3;
  const scale = rarity === 'legendary' ? 1.4 : rarity === 'epic' ? 1.25 : rarity === 'rare' ? 1.1 : 1.0;
  const width = Math.max(20, Math.round(26 * scale)); // compact
  const height = Math.max(20, Math.round(26 * scale));

  const floors: TowerFloor[] = [];

  // Helper to create a circular room with walls
  const generateFloor = (level: number): TowerFloor => {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const radius = Math.min(cx, cy) - 2 - Math.floor(level / 2); // slightly taper with height

    const grid: Cell[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ type: 'floor', walkable: true } as Cell))
    );

    // Carve outside as non-walkable, then draw circular wall
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Distance from center
        const dx = x - cx;
        const dy = y - cy;
        const d2 = Math.sqrt(dx * dx + dy * dy);
        if (d2 > radius + 0.6) {
          grid[y][x] = { type: 'wall', walkable: false };
        } else if (Math.abs(d2 - radius) < 0.8) {
          grid[y][x] = { type: 'wall', walkable: false };
        } else {
          grid[y][x] = { type: 'floor', walkable: true };
        }
      }
    }

    // Door (only on ground floor); stairs positions
    const entrance = level === 0 ? { x: cx, y: height - (cy - radius) - 2 } : undefined;
    if (entrance) grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };

    const stairsDown = level > 0 ? { x: cx - 2, y: cy } : undefined;
    const stairsUp = level < floorsCount - 1 ? { x: cx + 2, y: cy } : undefined;
    if (stairsDown) grid[stairsDown.y][stairsDown.x] = { type: 'stairs_down', walkable: true };
    if (stairsUp) grid[stairsUp.y][stairsUp.x] = { type: 'stairs_up', walkable: true };

    // Add a few decorative walls/bookshelves inside
    for (let i = 0; i < 20; i++) {
      const x = rng.randomInt(cx - radius + 2, cx + radius - 2);
      const y = rng.randomInt(cy - radius + 2, cy + radius - 2);
      if (grid[y][x].walkable && rng.random() < 0.2) {
        grid[y][x] = { type: 'wall', walkable: false };
      }
    }

    // Entities: more powerful/abundant with rarity
    const entities: TowerFloor['entities'] = [];
    const extraAdept = rarity === 'legendary' ? 2 : rarity === 'epic' ? 1 : 0;
    if (level === floorsCount - 1) {
      entities.push({ id: `wizard-${level}`, type: 'guard', position: { x: cx, y: cy - 1 }, state: { title: 'Archmage' } });
      for (let i = 0; i < extraAdept; i++) {
        entities.push({ id: `adept-top-${i}`, type: 'villager', position: { x: cx + i - 1, y: cy + 1 }, state: { role: 'adept' } });
      }
    } else if (level > 0) {
      entities.push({ id: `adept-${level}`, type: 'villager', position: { x: cx - 1, y: cy + 1 }, state: { role: 'adept' } });
      if (extraAdept > 0 && rng.random() < 0.5) {
        entities.push({ id: `adept2-${level}`, type: 'villager', position: { x: cx + 1, y: cy }, state: { role: 'adept' } });
      }
    }

    // Containers: a chest near a wall
    const containers: TowerFloor['containers'] = [];
    containers.push({ id: `chest-${level}`, position: { x: cx - 3, y: cy + 3 }, opened: false, items: [] });
    if (rarity === 'legendary' && level === floorsCount - 1) {
      containers.push({ id: `vault-${level}`, position: { x: cx + 3, y: cy - 3 }, opened: false, items: [] });
    }

    return { layout: grid, entities, containers, entrance, stairsUp, stairsDown };
  };

  for (let f = 0; f < floorsCount; f++) floors.push(generateFloor(f));

  // Build POIInterior with floor 0 reflected at top-level for compatibility
  const f0 = floors[0];
  const interior: POIInterior & { floors?: TowerFloor[]; currentFloor?: number } = {
    id: poiId,
    type: 'wizards_tower' as any,
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
