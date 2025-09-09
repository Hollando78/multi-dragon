import type { WorldSnapshot } from './worldGenerator.js';
import { DeterministicRNG } from './rng.js';

type Vec = { x: number; y: number };

function heuristic(a: Vec, b: Vec) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy;
}

export function generateRoads(world: WorldSnapshot, seed: string) {
  const rng = new DeterministicRNG(`${seed}:roads`);
  const size = world.size;
  const biome = world.biomeMap;
  const height = world.heightMap;
  const rivers = world.rivers || [];

  // Build a quick river mask
  const riverMask: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (const r of rivers) {
    for (const p of r.points) {
      const x = Math.max(0, Math.min(size - 1, Math.round(p.x)));
      const y = Math.max(0, Math.min(size - 1, Math.round(p.y)));
      riverMask[y][x] = true;
    }
  }

  // Settlements: villages + towns
  const nodes: Vec[] = (world.pois || [])
    .filter((p: any) => p.type === 'village' || p.type === 'town')
    .map((p: any) => ({ x: p.position.x, y: p.position.y }));
  if (nodes.length < 2) return [] as Vec[][];

  // Label landmasses (connected components of non-ocean tiles)
  const comp: number[][] = Array.from({ length: size }, () => Array(size).fill(-1));
  let compCount = 0;
  const q: Array<[number, number]> = [];
  const dirs4 = [[1,0],[-1,0],[0,1],[0,-1]] as const;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (comp[y][x] !== -1) continue;
      if (!isFinite(cellCost(x, y))) { comp[y][x] = -2; continue; }
      // BFS to fill component
      const id = compCount++;
      comp[y][x] = id;
      q.length = 0; q.push([x, y]);
      while (q.length) {
        const [cx, cy] = q.shift()!;
        for (const [dx, dy] of dirs4) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          if (comp[ny][nx] !== -1) continue;
          if (!isFinite(cellCost(nx, ny))) { comp[ny][nx] = -2; continue; }
          comp[ny][nx] = id;
          q.push([nx, ny]);
        }
      }
    }
  }

  // Component id for each node (settlement)
  const nodeComp: number[] = nodes.map(n => comp[n.y]?.[n.x] ?? -2);

  // Build MST edges per landmass with simple river crossing penalty in edge weight
  const edges: [number, number][] = [];
  const groups = new Map<number, number[]>();
  for (let i = 0; i < nodeComp.length; i++) {
    const id = nodeComp[i];
    if (id < 0) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(i);
  }
  function edgeWeight(i: number, j: number) {
    const a = nodes[i], b = nodes[j];
    const dx = a.x - b.x, dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    // Sample along the straight line to count river touches (approximate crossings)
    let samples = 0, crosses = 0;
    const steps = Math.max(1, Math.floor(dist));
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(a.x + (dx * t) / steps);
      const y = Math.round(a.y + (dy * t) / steps);
      samples++;
      if (y >= 0 && y < size && x >= 0 && x < size && riverMask[y][x]) crosses++;
    }
    const crossRatio = crosses / Math.max(1, samples);
    return dist * (1 + 3 * crossRatio); // penalize lines that go over rivers a lot
  }
  for (const [, idxs] of groups) {
    if (idxs.length < 2) continue;
    const inMST: boolean[] = Array(nodes.length).fill(false);
    inMST[idxs[0]] = true;
    let added = 0;
    while (added < idxs.length - 1) {
      let bestI = -1, bestJ = -1, bestW = Infinity;
      for (const i of idxs) if (inMST[i]) {
        for (const j of idxs) if (!inMST[j]) {
          const w = edgeWeight(i, j);
          if (w < bestW) { bestW = w; bestI = i; bestJ = j; }
        }
      }
      if (bestI >= 0 && bestJ >= 0) {
        inMST[bestJ] = true;
        edges.push([bestI, bestJ]);
        added++;
      } else {
        break;
      }
    }
    // Add a small number of extra edges within the same component
    const extras = Math.min(2, Math.floor(idxs.length / 3));
    for (let e = 0; e < extras; e++) {
      const i = idxs[rng.randomInt(0, idxs.length - 1)];
      const j = idxs[rng.randomInt(0, idxs.length - 1)];
      if (i !== j) edges.push([i, j]);
    }
  }

  // A* pathing on biome grid to avoid mountains/ocean and prefer plains
  function cellCost(x: number, y: number) {
    const b = biome[y][x];
    if (b === 'ocean') return Infinity;
    if (b === 'mountain') return 50; // avoid if possible
    if (b === 'alpine') return 30;
    if (b === 'hills') return 4;
    if (b === 'forest' || b === 'taiga') return 3;
    if (b === 'beach' || b === 'coast') return 2;
    // default grassland/shrubland/savanna/tundra/desert
    return 1.5;
  }
  function riverExtra(x: number, y: number) { return riverMask[y][x] ? 10 : 0; }

  // Encourage reuse/merging: existing road tiles are cheaper
  const roadMask: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  function roadBonus(x: number, y: number) { return roadMask[y][x] ? 1.0 : 0; }

  function pathfind(start: Vec, goal: Vec): Vec[] {
    const sx = start.x, sy = start.y, gx = goal.x, gy = goal.y;
    const open: [number, number, number][] = []; // [f, x, y]
    const push = (f: number, x: number, y: number) => {
      // simple insertion (small sizes)
      let i = 0; while (i < open.length && open[i][0] < f) i++; open.splice(i, 0, [f, x, y]);
    };
    const gScore: number[][] = Array.from({ length: size }, () => Array(size).fill(Infinity));
    const cameFrom: Array<Array<[number, number] | null>> = Array.from({ length: size }, () => Array(size).fill(null));
    gScore[sy][sx] = 0;
    push(heuristic({ x: sx, y: sy }, { x: gx, y: gy }), sx, sy);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]] as const;
    const maxIter = size * size;
    let iter = 0;
    while (open.length && iter++ < maxIter) {
      const [_, x, y] = open.shift()!;
      if (x === gx && y === gy) {
        // reconstruct
        const path: Vec[] = [];
        let cx = x, cy = y;
        while (!(cx === sx && cy === sy)) {
          path.push({ x: cx, y: cy });
          const prev = cameFrom[cy][cx]; if (!prev) break; cx = prev[0]; cy = prev[1];
        }
        path.push({ x: sx, y: sy });
        path.reverse();
        return path;
      }
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const base = cellCost(nx, ny);
        if (!isFinite(base)) continue;
        const tentative = gScore[y][x] + base + riverExtra(nx, ny) - roadBonus(nx, ny);
        if (tentative < gScore[ny][nx]) {
          gScore[ny][nx] = tentative;
          cameFrom[ny][nx] = [x, y];
          const f = tentative + heuristic({ x: nx, y: ny }, { x: gx, y: gy });
          push(f, nx, ny);
        }
      }
    }
    // No path found without crossing oceans; skip this road
    return [];
  }

  const roads: Vec[][] = [];
  for (const [i, j] of edges) {
    const a = nodes[i], b = nodes[j];
    const path = pathfind(a, b);
    if (path.length >= 2) {
      // Optional thinning: sample every N steps to lighten payload
      const step = 1;
      const simplified: Vec[] = [];
      for (let k = 0; k < path.length; k += step) simplified.push(path[k]);
      // Snap segments onto existing road tiles to merge visually
      for (let k = 1; k < simplified.length - 1; k++) {
        const p = simplified[k];
        const { x, y } = p;
        if (roadMask[y] && roadMask[y][x]) continue;
        // Check 4-neighbors for existing road and snap
        const n = [[1,0],[-1,0],[0,1],[0,-1]] as const;
        for (const [dx, dy] of n) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && roadMask[ny][nx]) {
            simplified[k] = { x: nx, y: ny };
            break;
          }
        }
      }
      // Mark this road on mask so future paths prefer to merge
      for (const p of simplified) {
        if (p.y >= 0 && p.y < size && p.x >= 0 && p.x < size) roadMask[p.y][p.x] = true;
      }
      roads.push(simplified);
    }
  }

  return roads;
}
