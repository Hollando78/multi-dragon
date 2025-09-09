import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';
import type { Rarity } from './constants.js';

type CellType = 'wall' | 'floor' | 'entrance' | 'door';
type Cell = { type: CellType; walkable: boolean; sprite?: string };

type DragonType = 'red' | 'green' | 'brown' | 'gold';

function pickDragonType(rng: DeterministicRNG, rarity: Rarity): DragonType {
  // Gold rarer; epic/legendary slightly more likely
  const r = rng.random();
  const goldW = rarity === 'legendary' ? 0.25 : rarity === 'epic' ? 0.15 : rarity === 'rare' ? 0.08 : 0.03;
  const redW = 0.35;
  const greenW = 0.3;
  const brownW = 1 - (goldW + redW + greenW);
  if (r < goldW) return 'gold';
  if (r < goldW + redW) return 'red';
  if (r < goldW + redW + greenW) return 'green';
  return 'brown';
}

export function generateDragonGrounds(poiId: string, seed: string, rarity: Rarity = 'common'): POIInterior {
  const rng = new DeterministicRNG(seed);
  const dragonType = pickDragonType(rng, rarity);
  const scale = rarity === 'legendary' ? 1.6 : rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.15 : 1.0;
  const width = Math.max(48, Math.round(56 * scale));
  const height = Math.max(36, Math.round(42 * scale));

  // Initialize as walls
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'wall', walkable: false } as Cell))
  );

  // Helper
  const carveRect = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (xx > 0 && yy > 0 && xx < width - 1 && yy < height - 1) grid[yy][xx] = { type: 'floor', walkable: true };
      }
    }
  };
  const carveCorridor = (x1: number, y1: number, x2: number, y2: number, w = 3) => {
    // Simple L-shaped corridor with width w
    const midX = x2;
    const minx = Math.min(x1, midX), maxx = Math.max(x1, midX);
    for (let x = minx; x <= maxx; x++) carveRect(x, y1 - Math.floor(w / 2), 1, w);
    const miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
    for (let y = miny; y <= maxy; y++) carveRect(x2 - Math.floor(w / 2), y, w, 1);
  };

  // Entrance chamber near bottom center
  const entW = 10, entH = 8;
  const entX = Math.floor(width / 2) - Math.floor(entW / 2);
  const entY = height - entH - 2;
  carveRect(entX, entY, entW, entH);
  const entrance = { x: entX + Math.floor(entW / 2), y: entY + entH - 1 };
  grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };

  // Determine number of chambers by rarity
  const chambers = rarity === 'legendary' ? rng.randomInt(4, 6) : rarity === 'epic' ? rng.randomInt(3, 5) : rarity === 'rare' ? rng.randomInt(2, 4) : rng.randomInt(1, 3);
  const rooms: Array<{ x: number; y: number; w: number; h: number }> = [{ x: entX, y: entY, w: entW, h: entH }];

  // Create additional chambers distributed towards the top and sides
  for (let i = 0; i < chambers; i++) {
    const rw = rng.randomInt(10, 16);
    const rh = rng.randomInt(8, 12);
    const rx = rng.randomInt(4, width - rw - 4);
    const ry = rng.randomInt(4, Math.floor(height / 2));
    carveRect(rx, ry, rw, rh);
    // Connect to previous room center
    const prev = rooms[rooms.length - 1];
    const cx1 = prev.x + Math.floor(prev.w / 2);
    const cy1 = prev.y + Math.floor(prev.h / 2);
    const cx2 = rx + Math.floor(rw / 2);
    const cy2 = ry + Math.floor(rh / 2);
    carveCorridor(cx1, cy1, cx2, cy2, 3);
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }

  // Optionally add a dungeon branch (epic+)
  if (rarity === 'epic' || rarity === 'legendary') {
    const base = rooms[Math.floor(rooms.length / 2)];
    const dx = Math.max(3, base.x - rng.randomInt(12, 18));
    const dy = base.y + rng.randomInt(0, base.h - 6);
    carveCorridor(base.x + 2, base.y + Math.floor(base.h / 2), dx + 4, dy + 3, 3);
    carveRect(dx, dy, 8, 6);
  }

  const entities: POIInterior['entities'] = [];
  const containers: POIInterior['containers'] = [];

  // Entrance guards: thralls or junior dragons
  const guardChance = rarity === 'legendary' ? 0.9 : rarity === 'epic' ? 0.7 : rarity === 'rare' ? 0.5 : 0.3;
  if (rng.random() < guardChance) {
    const count = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      if (rng.random() < 0.5 && rarity !== 'common') {
        entities.push({ id: `jdragon-${i}`, type: 'junior_dragon', name: 'Young Dragon', position: { x: entrance.x - 2 + i * 2, y: entrance.y - 2 }, state: {} });
      } else {
        entities.push({ id: `thrall-${i}`, type: 'thrall', name: 'Thrall', position: { x: entrance.x - 2 + i * 2, y: entrance.y - 2 }, state: {} });
      }
    }
  }

  // Prisoners in dungeon (if present)
  if (rarity === 'epic' || rarity === 'legendary') {
    const px = rooms[rooms.length - 2]?.x || entX;
    const py = rooms[rooms.length - 2]?.y || entY - 4;
    const prisoners = rng.randomInt(1, rarity === 'legendary' ? 4 : 2);
    for (let i = 0; i < prisoners; i++) {
      entities.push({ id: `prisoner-${i}`, type: 'prisoner', name: 'Prisoner', position: { x: px + 2 + i, y: py + 2 }, state: {} });
    }
  }

  // Dragon lair: last chamber center
  const lair = rooms[rooms.length - 1];
  const lairCx = lair.x + Math.floor(lair.w / 2);
  const lairCy = lair.y + Math.floor(lair.h / 2);
  const dragonName = `${dragonType.charAt(0).toUpperCase()}${dragonType.slice(1)} Dragon`;
  entities.push({ id: 'dragon', type: 'dragon', name: dragonName, position: { x: lairCx, y: lairCy - 1 }, state: { dragonType } });

  // Gold bed for gold dragon (and small hoard for higher rarity)
  const goldDensity = dragonType === 'gold' ? (rarity === 'legendary' ? 30 : rarity === 'epic' ? 18 : rarity === 'rare' ? 10 : 6) : (rarity === 'legendary' ? 10 : rarity === 'epic' ? 6 : 3);
  for (let i = 0; i < goldDensity; i++) {
    const gx = rng.randomInt(lair.x + 1, lair.x + lair.w - 2);
    const gy = rng.randomInt(lair.y + 1, lair.y + lair.h - 2);
    if (grid[gy][gx].walkable) {
      entities.push({ id: `gold-${i}`, type: 'gold_pile', name: 'Gold', position: { x: gx, y: gy }, state: {} });
    }
  }

  // Chests across chambers
  const chestCount = rarity === 'legendary' ? 8 : rarity === 'epic' ? 6 : rarity === 'rare' ? 4 : 3;
  for (let i = 0; i < chestCount; i++) {
    const room = rooms[rng.randomInt(0, rooms.length - 1)];
    const cx = rng.randomInt(room.x + 1, room.x + room.w - 2);
    const cy = rng.randomInt(room.y + 1, room.y + room.h - 2);
    containers.push({ id: `chest-${i}`, position: { x: cx, y: cy }, opened: false, items: [] });
  }

  const interior: POIInterior = {
    id: poiId,
    type: 'dragon_grounds' as any,
    seed,
    generatedAt: new Date().toISOString(),
    layout: grid,
    entrance,
    entities,
    containers,
    cleared: false,
  };

  return interior;
}

