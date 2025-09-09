import { DeterministicRNG } from './rng.js';

export interface Cell {
  type: 'grass' | 'road' | 'wall' | 'floor' | 'door' |
        'tavern' | 'blacksmith' | 'alchemist' | 'bank' | 'library' | 'market' | 'guardhouse' | 'temple';
  walkable: boolean;
  sprite?: string;
}

export interface TownEntity {
  id: string;
  type: 'villager' | 'merchant' | 'guard' | 'blacksmith' | 'alchemist' | 'banker' | 'priest' | 'librarian' | 'innkeeper';
  position: { x: number; y: number };
  name: string;
  role: string;
  dialogue?: string[];
}

export interface TownInterior {
  id: string;
  type: 'town';
  seed: string;
  width: number;
  height: number;
  layout: Cell[][];
  entities: TownEntity[];
  entrance: { x: number; y: number };
}

export function generateTownInterior(poiId: string, seed: string, rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common'): TownInterior {
  const rng = new DeterministicRNG(seed);
  const scale = rarity === 'legendary' ? 1.8 : rarity === 'epic' ? 1.5 : rarity === 'rare' ? 1.25 : 1.0;
  const width = Math.max(48, Math.round(56 * scale));
  const height = Math.max(40, Math.round(48 * scale));

  // Base grass
  const layout: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'grass', walkable: true } as Cell))
  );

  // Road grid: main horizontal/vertical with branches
  const roadY = Math.floor(height / 2);
  const roadX = Math.floor(width / 2);
  const carveRoad = (y: number, x1: number, x2: number) => { for (let x = x1; x <= x2; x++) layout[y][x] = { type: 'road', walkable: true }; };
  const carveCol = (x: number, y1: number, y2: number) => { for (let y = y1; y <= y2; y++) layout[y][x] = { type: 'road', walkable: true }; };
  for (let dy = -1; dy <= 1; dy++) carveRoad(roadY + dy, 1, width - 2);
  for (let dx = -1; dx <= 1; dx++) carveCol(roadX + dx, 1, height - 2);
  // Extra branches depending on rarity
  const branches = rarity === 'legendary' ? 6 : rarity === 'epic' ? 4 : rarity === 'rare' ? 2 : 1;
  for (let i = 0; i < branches; i++) {
    if (rng.random() < 0.5) carveRoad(rng.randomInt(2, height - 3), rng.randomInt(2, roadX - 2), rng.randomInt(roadX + 2, width - 3));
    else carveCol(rng.randomInt(2, width - 3), rng.randomInt(2, roadY - 2), rng.randomInt(roadY + 2, height - 3));
  }

  const entities: TownEntity[] = [];

  // Entrance at south center
  const entrance = { x: roadX, y: height - 2 };
  layout[entrance.y][entrance.x] = { type: 'door', walkable: true };

  // Building placement helper
  function placeBuilding(type: Cell['type'], size: number): { x: number; y: number } | null {
    const maxAttempts = 80;
    for (let a = 0; a < maxAttempts; a++) {
      const x = rng.randomInt(2, width - size - 2);
      const y = rng.randomInt(2, height - size - 2);
      // Require proximity to road and empty area
      let nearRoad = false, clear = true;
      for (let yy = y; yy < y + size && clear; yy++) {
        for (let xx = x; xx < x + size && clear; xx++) {
          if (layout[yy][xx].type !== 'grass') clear = false;
          for (let oy = -1; oy <= 1 && !nearRoad; oy++) {
            for (let ox = -1; ox <= 1 && !nearRoad; ox++) {
              const ny = yy + oy, nx = xx + ox;
              if (ny>=0&&ny<height&&nx>=0&&nx<width && layout[ny][nx].type === 'road') nearRoad = true;
            }
          }
        }
      }
      if (!clear || !nearRoad) continue;
      // Draw walls/floor
      for (let yy = y; yy < y + size; yy++) {
        for (let xx = x; xx < x + size; xx++) {
          const edge = yy === y || yy === y + size - 1 || xx === x || xx === x + size - 1;
          layout[yy][xx] = edge ? { type: 'wall', walkable: false } : { type: 'floor', walkable: true };
        }
      }
      // Door on nearest road side; for simplicity, bottom center
      layout[y + size - 1][x + Math.floor(size / 2)] = { type: 'door', walkable: true };
      // Mark building footprint type overlay (for rendering hint)
      layout[y + 1][x + 1] = { type, walkable: true };
      return { x, y };
    }
    return null;
  }

  // Ensure a Tavern
  const tavern = placeBuilding('tavern', 6);
  if (tavern) {
    entities.push({ id: rng.generateUUID('innkeeper'), type: 'innkeeper', position: { x: tavern.x + 2, y: tavern.y + 2 }, name: 'Innkeeper', role: 'tavern_keeper', dialogue: ['Welcome to the tavern!', 'Rooms available upstairs.'] });
  }

  // Chance-based buildings; chance scales with rarity
  const chance = (base: number) => base * (rarity === 'legendary' ? 1.8 : rarity === 'epic' ? 1.5 : rarity === 'rare' ? 1.2 : 1.0);
  if (rng.random() < chance(0.7)) {
    const b = placeBuilding('blacksmith', 6);
    if (b) entities.push({ id: rng.generateUUID('blacksmith'), type: 'blacksmith', position: { x: b.x + 2, y: b.y + 2 }, name: 'Blacksmith', role: 'blacksmith', dialogue: ['I can sharpen your steel.', 'Best blades in town.'] });
  }
  if (rng.random() < chance(0.6)) {
    const a = placeBuilding('alchemist', 6);
    if (a) entities.push({ id: rng.generateUUID('alchemist'), type: 'alchemist', position: { x: a.x + 2, y: a.y + 2 }, name: 'Alchemist', role: 'alchemist', dialogue: ['Potions for all ailments.', 'Mind the fumes.'] });
  }
  if (rng.random() < chance(0.5)) {
    const k = placeBuilding('bank', 6);
    if (k) entities.push({ id: rng.generateUUID('banker'), type: 'banker', position: { x: k.x + 2, y: k.y + 2 }, name: 'Banker', role: 'banker', dialogue: ['Your deposits are safe.', 'We offer fair rates.'] });
  }
  if (rng.random() < chance(0.5)) {
    const l = placeBuilding('library', 6);
    if (l) entities.push({ id: rng.generateUUID('librarian'), type: 'librarian', position: { x: l.x + 2, y: l.y + 2 }, name: 'Librarian', role: 'librarian', dialogue: ['Keep your voice down.', 'Knowledge awaits.'] });
  }
  if (rng.random() < chance(0.6)) {
    const m = placeBuilding('market', 8);
    if (m) entities.push({ id: rng.generateUUID('merchant'), type: 'merchant', position: { x: m.x + 3, y: m.y + 3 }, name: 'Trader', role: 'merchant', dialogue: ['Fresh goods from afar.'] });
  }
  if (rng.random() < chance(0.5)) {
    const g = placeBuilding('guardhouse', 6);
    if (g) entities.push({ id: rng.generateUUID('guard'), type: 'guard', position: { x: g.x + 2, y: g.y + 2 }, name: 'Guard', role: 'guard', dialogue: ['Keep the peace.', 'On patrol.'] });
  }
  if (rng.random() < chance(0.5)) {
    const t = placeBuilding('temple', 6);
    if (t) entities.push({ id: rng.generateUUID('priest'), type: 'priest', position: { x: t.x + 2, y: t.y + 2 }, name: 'Priest', role: 'priest', dialogue: ['Blessings upon you.'] });
  }

  return {
    id: poiId,
    type: 'town',
    seed,
    width,
    height,
    layout,
    entities,
    entrance
  };
}

