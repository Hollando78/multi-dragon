import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';
import type { Rarity } from './constants.js';

type Cell = { type: 'wall' | 'floor' | 'entrance' | 'door'; walkable: boolean };

export function generateAncientCircle(poiId: string, seed: string, rarity: Rarity = 'common'): POIInterior {
  const rng = new DeterministicRNG(seed);
  const scale = rarity === 'legendary' ? 1.6 : rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.15 : 1.0;
  const width = Math.max(36, Math.round(40 * scale));
  const height = Math.max(28, Math.round(32 * scale));

  // Base floor
  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'floor', walkable: true } as Cell))
  );

  // Entrance at south
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const entrance = { x: cx, y: height - 2 };
  grid[entrance.y][entrance.x] = { type: 'entrance', walkable: true };
  // Carve a path northwards from entrance to center
  for (let y = entrance.y; y >= cy; y--) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      if (y >= 0 && y < height && x >= 0 && x < width) grid[y][x] = { type: 'floor', walkable: true };
    }
  }

  // Standing stones ring(s)
  const rings = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 2 : 1;
  const entities: POIInterior['entities'] = [];
  const containers: POIInterior['containers'] = [];

  for (let r = 0; r < rings; r++) {
    const radius = Math.floor(Math.min(width, height) / 2.8) - r * 3;
    const stones = Math.max(8, Math.round(12 * scale) - r * 2);
    for (let i = 0; i < stones; i++) {
      const angle = (i / stones) * Math.PI * 2;
      const x = cx + Math.round(Math.cos(angle) * radius);
      const y = cy + Math.round(Math.sin(angle) * radius);
      if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
        grid[y][x] = { type: 'wall', walkable: false };
        entities.push({ id: `stone-${r}-${i}`, type: 'megalith', name: 'Standing Stone', position: { x, y }, state: {} });
      }
    }
  }

  // Central altar/circle
  entities.push({ id: 'altar', type: 'altar', name: 'Altar', position: { x: cx, y: cy }, state: {} });
  // Clear small area around altar
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (y >= 0 && y < height && x >= 0 && x < width) grid[y][x] = { type: 'floor', walkable: true };
    }
  }

  // Druids and ritualists based on rarity
  const druidCount = rarity === 'legendary' ? 5 : rarity === 'epic' ? 4 : rarity === 'rare' ? 3 : 2;
  for (let i = 0; i < druidCount; i++) {
    const a = (i / druidCount) * Math.PI * 2;
    const rx = cx + Math.round(Math.cos(a) * 3);
    const ry = cy + Math.round(Math.sin(a) * 3);
    entities.push({ id: `druid-${i}`, type: 'druid', name: 'Druid', position: { x: rx, y: ry }, state: {} });
  }

  // Chance of a portal or rune circle for high rarity
  if (rarity === 'legendary' || (rarity === 'epic' && rng.random() < 0.5)) {
    const px = cx + rng.randomInt(-2, 2);
    const py = cy + rng.randomInt(-2, 2);
    entities.push({ id: 'portal', type: 'portal', name: 'Ancient Portal', position: { x: px, y: py }, state: {} });
  }

  // Small treasure chests occasionally
  const chests = rarity === 'legendary' ? 4 : rarity === 'epic' ? 3 : rarity === 'rare' ? 2 : 1;
  for (let i = 0; i < chests; i++) {
    const x = rng.randomInt(2, width - 3);
    const y = rng.randomInt(2, height - 3);
    if (grid[y][x].walkable) containers.push({ id: `chest-${i}`, position: { x, y }, opened: false, items: [] });
  }

  return {
    id: poiId,
    type: 'ancient_circle' as any,
    seed,
    generatedAt: new Date().toISOString(),
    layout: grid,
    entrance,
    entities,
    containers,
    cleared: false,
  };
}

