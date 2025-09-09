import { DeterministicRNG } from './rng.js';
import type { POIInterior } from './constants.js';

type Cell = { type: 'wall' | 'floor' | 'entrance'; walkable: boolean; sprite?: string };

export function generateDarkCave(poiId: string, seed: string, opts?: { guaranteedEgg?: boolean }): POIInterior {
  const rng = new DeterministicRNG(seed);
  const width = 48;
  const height = 36;

  // Initialize random map
  let grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'wall', walkable: false }))
  );

  // Random seed fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (border) {
        grid[y][x] = { type: 'wall', walkable: false };
      } else {
        const v = rng.random();
        const floor = v > 0.45; // ~55% floors
        grid[y][x] = { type: floor ? 'floor' : 'wall', walkable: floor };
      }
    }
  }

  // Cellular automata smoothing
  const countNeighbors = (gx: number, gy: number) => {
    let walls = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) { walls++; continue; }
        if (grid[ny][nx].type === 'wall') walls++;
      }
    }
    return walls;
  };

  for (let iter = 0; iter < 4; iter++) {
    const next: Cell[][] = grid.map(row => row.map(c => ({ ...c })));
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const walls = countNeighbors(x, y);
        if (walls > 4) next[y][x] = { type: 'wall', walkable: false };
        else if (walls < 4) next[y][x] = { type: 'floor', walkable: true };
      }
    }
    grid = next;
  }

  // Ensure main cavern connectivity using a simple flood fill from entrance candidate
  const entranceX = Math.floor(width / 2);
  let entranceY = 1;
  for (let y = 1; y < Math.min(6, height - 1); y++) {
    if (grid[y][entranceX].walkable) { entranceY = y; break; }
  }
  grid[entranceY][entranceX] = { type: 'entrance', walkable: true };

  // Carve a small corridor from the entrance inward to guarantee initial mobility
  const carve = (x: number, y: number) => { if (x>0&&y>0&&x<width-1&&y<height-1) grid[y][x] = { type: 'floor', walkable: true }; };
  const corridorLen = 6;
  for (let i = 1; i <= corridorLen; i++) {
    const y = entranceY + i;
    const x = entranceX;
    carve(x, y);
    if (rng.random() < 0.6) { carve(x-1, y); }
    if (rng.random() < 0.6) { carve(x+1, y); }
  }

  const visited = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const q: Array<{ x: number; y: number }> = [{ x: entranceX, y: entranceY }];
  visited.add(key(entranceX, entranceY));
  while (q.length) {
    const { x, y } = q.shift()!;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!grid[ny][nx].walkable) continue;
      const k = key(nx, ny);
      if (!visited.has(k)) { visited.add(k); q.push({ x: nx, y: ny }); }
    }
  }
  // Cull unreachable floors
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x].walkable && !visited.has(key(x, y))) {
        grid[y][x] = { type: 'wall', walkable: false };
      }
    }
  }
  // Ensure a minimal open area around entrance
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = entranceX + dx, y = entranceY + dy;
      if (x>0&&y>0&&x<width-1&&y<height-1) grid[y][x] = { type: dy===0&&dx===0 ? 'entrance' : 'floor', walkable: true };
    }
  }

  // Place containers at floor dead-ends
  const containers: POIInterior['containers'] = [];
  const entities: POIInterior['entities'] = [];
  let chestCount = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (!grid[y][x].walkable) continue;
      let openNeighbors = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        if (grid[y+dy][x+dx].walkable) openNeighbors++;
      }
      if (openNeighbors === 1 && chestCount < 5 && rng.random() < 0.25) {
        containers.push({
          id: `chest-${x}-${y}`,
          position: { x, y },
          opened: false,
          items: []
        });
        chestCount++;
      }
    }
  }

  // Place a few bat/slime entities
  const creatureTypes = ['bat', 'slime'];
  const creatureCount = rng.randomInt(3, 7);
  for (let i = 0; i < creatureCount; i++) {
    let placed = false;
    for (let attempts = 0; attempts < 50 && !placed; attempts++) {
      const x = rng.randomInt(2, width - 3);
      const y = rng.randomInt(2, height - 3);
      if (!grid[y][x].walkable) continue;
      if (x === entranceX && y === entranceY) continue;
      entities.push({ id: `mob-${i}`, type: rng.randomElement(creatureTypes)!, position: { x, y }, state: {} });
      placed = true;
    }
  }

  // If guaranteed egg is requested, place a dragon egg entity at a far tile from entrance
  if (opts?.guaranteedEgg) {
    // BFS distances from entrance to find farthest walkable cell
    const w = width, h = height;
    const dist = Array.from({ length: h }, () => Array(w).fill(Infinity));
    const q2: Array<{x:number;y:number}> = [{ x: entranceX, y: entranceY }];
    dist[entranceY][entranceX] = 0;
    while (q2.length) {
      const { x, y } = q2.shift()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx<0||ny<0||nx>=w||ny>=h) continue;
        if (!grid[ny][nx].walkable) continue;
        if (dist[ny][nx] > dist[y][x] + 1) {
          dist[ny][nx] = dist[y][x] + 1;
          q2.push({ x: nx, y: ny });
        }
      }
    }
    let fx = entranceX, fy = entranceY, best = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x].walkable && dist[y][x] !== Infinity && dist[y][x] > best) {
          best = dist[y][x]; fx = x; fy = y;
        }
      }
    }
    entities.push({ id: `egg-1`, type: 'dragon_egg', position: { x: fx, y: fy }, state: { special: true } });
  }

  const interior: POIInterior = {
    id: poiId,
    type: 'dark_cave',
    seed,
    generatedAt: new Date().toISOString(),
    layout: grid,
    entities,
    containers,
    cleared: false
  };

  return interior;
}