import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';
import type { Rarity } from './constants.js';

type Cell = { type: 'wall' | 'floor' | 'entrance' | 'door'; walkable: boolean; sprite?: string };

// Simple ruined castle layout:
// - Outer rectangular walls with a main gate (entrance) on the south
// - Central courtyard with scattered debris (represented as floor)
// - A few small rooms around the courtyard; some walls broken (missing segments)
// - A couple of chests in corners; a few guard entities standing watch
export function generateRuinedCastle(poiId: string, seed: string, rarity: Rarity = 'common'): POIInterior {
  const rng = new DeterministicRNG(seed);
  const scale = rarity === 'legendary' ? 1.6 : rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.15 : 1.0;
  const width = Math.max(30, Math.round(44 * scale));
  const height = Math.max(22, Math.round(32 * scale));

  // Initialize as floor
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'floor', walkable: true }))
  );

  // Helper to place wall with some chance of being ruined (hole)
  const wallOrHole = (x: number, y: number, holeChance = 0.12) => {
    if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return;
    if (rng.random() < holeChance) return; // leave floor (hole in the wall)
    grid[y][x] = { type: 'wall', walkable: false };
  };

  // Outer walls
  for (let x = 1; x < width - 1; x++) {
    wallOrHole(x, 1, 0.05);
    wallOrHole(x, height - 2, 0.05);
  }
  for (let y = 1; y < height - 1; y++) {
    wallOrHole(1, y, 0.05);
    wallOrHole(width - 2, y, 0.05);
  }

  // Main gate (entrance) at bottom center
  const entranceX = Math.floor(width / 2);
  const entranceY = height - 2;
  grid[entranceY][entranceX] = { type: 'entrance', walkable: true };
  for (let i = -1; i <= 1; i++) {
    // widen gate area
    grid[entranceY][entranceX + i] = { type: 'door', walkable: true };
  }

  // Inner ring/corridor walls around a central courtyard
  const innerMargin = 6;
  for (let x = innerMargin; x < width - innerMargin; x++) {
    wallOrHole(x, innerMargin, 0.15);
    wallOrHole(x, height - innerMargin - 1, 0.15);
  }
  for (let y = innerMargin; y < height - innerMargin; y++) {
    wallOrHole(innerMargin, y, 0.15);
    wallOrHole(width - innerMargin - 1, y, 0.15);
  }

  // Break a doorway connecting entrance to courtyard
  const doorY = height - innerMargin - 1;
  for (let i = -1; i <= 1; i++) {
    grid[doorY][entranceX + i] = { type: 'door', walkable: true };
  }

  // Add some small rooms attached to inner ring
  const addRoom = (rx: number, ry: number, rw: number, rh: number) => {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        const atEdge = y === ry || y === ry + rh - 1 || x === rx || x === rx + rw - 1;
        if (atEdge) {
          // broken walls here and there
          if (rng.random() < 0.2) continue; // missing stone
          grid[y][x] = { type: 'wall', walkable: false };
        } else {
          grid[y][x] = { type: 'floor', walkable: true };
        }
      }
    }
    // add a door to corridor side (rough guess)
    const mid = Math.floor(rw / 2);
    grid[ry + rh - 1][rx + mid] = { type: 'door', walkable: true };
  };

  addRoom(innerMargin + 1, innerMargin + 1, 6, 5);
  addRoom(width - innerMargin - 7, innerMargin + 1, 6, 5);
  addRoom(innerMargin + 1, height - innerMargin - 6, 6, 5);
  addRoom(width - innerMargin - 7, height - innerMargin - 6, 6, 5);

  // Scatter some debris holes inside the courtyard
  const debrisCount = Math.round(60 * scale);
  for (let i = 0; i < debrisCount; i++) {
    const x = rng.randomInt(innerMargin + 1, width - innerMargin - 2);
    const y = rng.randomInt(innerMargin + 1, height - innerMargin - 2);
    if (rng.random() < 0.25) grid[y][x] = { type: 'wall', walkable: false };
  }

  // Containers (chests) in corners of the courtyard
  const containers: POIInterior['containers'] = [];
  const pushChest = (x: number, y: number) => {
    containers.push({ id: `chest-${x}-${y}`, position: { x, y }, opened: false, items: [] });
  };
  const chestPositions = [
    { x: innerMargin + 2, y: innerMargin + 2 },
    { x: width - innerMargin - 3, y: innerMargin + 2 },
    { x: innerMargin + 2, y: height - innerMargin - 3 },
    { x: width - innerMargin - 3, y: height - innerMargin - 3 },
  ];
  const extraChests = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 1 : 0;
  chestPositions.forEach(p => pushChest(p.x, p.y));
  for (let i = 0; i < extraChests; i++) {
    pushChest(rng.randomInt(innerMargin + 2, width - innerMargin - 3), rng.randomInt(innerMargin + 2, height - innerMargin - 3));
  }

  // Entities: a few castle guards (re-using existing 'guard' type coloring)
  const entities: POIInterior['entities'] = [];
  const baseGuards = [
    { x: entranceX - 3, y: doorY + 1 },
    { x: entranceX + 3, y: doorY + 1 },
    { x: innerMargin + 3, y: innerMargin + 3 },
    { x: width - innerMargin - 4, y: innerMargin + 3 }
  ];
  const extraGuards = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 0;
  const guardPositions = baseGuards.concat(
    Array.from({ length: extraGuards }, () => ({ x: rng.randomInt(innerMargin + 2, width - innerMargin - 3), y: rng.randomInt(innerMargin + 2, height - innerMargin - 3) }))
  );
  guardPositions.forEach((p, i) => {
    if (p.x > 1 && p.y > 1 && p.x < width - 1 && p.y < height - 1) {
      if (grid[p.y][p.x].walkable) {
        entities.push({ id: `guard-${i}`, type: 'guard', position: { x: p.x, y: p.y }, state: {} });
      }
    }
  });

  // Build POIInterior
  const interior: POIInterior = {
    id: poiId,
    type: 'ruined_castle' as any,
    seed,
    generatedAt: new Date().toISOString(),
    layout: grid,
    entrance: { x: entranceX, y: entranceY },
    entities,
    containers,
    cleared: false
  };

  return interior;
}
