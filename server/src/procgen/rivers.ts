import { DeterministicRNG } from './rng.js';
import { 
  Vector2, 
  SEA_LEVEL, 
  MAX_ELEVATION,
  distance,
  clamp
} from './constants.js';

export interface RiverPoint {
  x: number;
  y: number;
  width: number;  // Width at this specific point
}

export interface RiverSegment {
  points: RiverPoint[];  // Now each point has its own width
  streamOrder: number;  // Strahler stream order for proper widening
  flowAccumulation: number;  // How much water flows through this segment
}

export interface RiverSystem {
  segments: RiverSegment[];
  confluences: Vector2[];  // Where rivers merge
}

interface FlowNode {
  x: number;
  y: number;
  flowsTo: FlowNode | null;
  flowAccumulation: number;
  streamOrder: number;
  visited: boolean;
}

export function generateRivers(
  heightMap: number[][],
  seed: string
): RiverSystem {
  const rng = new DeterministicRNG(seed);
  const size = heightMap.length;
  
  // Step 1: Build flow direction map using enhanced gradient descent
  const flowMap = buildFlowMap(heightMap);
  
  // Step 2: Select river source points in highlands/mountains
  const sources = selectRiverSources(heightMap, flowMap, rng);
  
  // Step 3: Trace rivers from sources to ocean, accumulating flow
  const riverPaths = traceRiverPaths(sources, flowMap, heightMap);
  
  // Step 4: Calculate stream orders and merge tributaries
  const mergedSystem = mergeRiverSystem(riverPaths, heightMap);
  
  // Step 5: Calculate river widths based on stream order and flow accumulation
  const segments = calculateRiverWidths(mergedSystem, heightMap);
  
  // Step 6: Find confluence points
  const confluences = findConfluences(segments);
  
  return {
    segments,
    confluences
  };
}

function buildFlowMap(heightMap: number[][]): FlowNode[][] {
  const size = heightMap.length;
  const flowMap: FlowNode[][] = [];
  
  // Initialize flow nodes
  for (let y = 0; y < size; y++) {
    flowMap[y] = [];
    for (let x = 0; x < size; x++) {
      flowMap[y][x] = {
        x,
        y,
        flowsTo: null,
        flowAccumulation: 1, // Each cell starts with 1 unit of water
        streamOrder: 0,
        visited: false
      };
    }
  }
  
  // Calculate flow directions using enhanced gradient descent
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const currentHeight = heightMap[y][x];
      
      // Skip if already in deep ocean (but allow flow through beach/coast to reach ocean)
      if (currentHeight <= SEA_LEVEL * 0.5) {
        continue;
      }
      
      let bestNeighbor: FlowNode | null = null;
      let bestScore = 0;
      
      // Check all 8 neighbors
      const neighbors = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
      ];
      
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        
        const neighborHeight = heightMap[ny][nx];
        const drop = currentHeight - neighborHeight;
        
        // Only flow downhill
        if (drop <= 0) continue;
        
        // Score based on steepness and diagonal penalty
        const isDiagonal = Math.abs(dx) + Math.abs(dy) === 2;
        const diagonalPenalty = isDiagonal ? 0.7 : 1.0;
        const score = drop * diagonalPenalty;
        
        if (score > bestScore) {
          bestScore = score;
          bestNeighbor = flowMap[ny][nx];
        }
      }
      
      flowMap[y][x].flowsTo = bestNeighbor;
    }
  }
  
  // Calculate flow accumulation
  calculateFlowAccumulation(flowMap);
  
  return flowMap;
}

function calculateFlowAccumulation(flowMap: FlowNode[][]): void {
  const size = flowMap.length;
  
  // Build reverse map: for each cell, track which cells flow into it
  const inflowMap = new Map<string, FlowNode[]>();
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const node = flowMap[y][x];
      if (node.flowsTo) {
        const targetKey = `${node.flowsTo.x},${node.flowsTo.y}`;
        if (!inflowMap.has(targetKey)) {
          inflowMap.set(targetKey, []);
        }
        inflowMap.get(targetKey)!.push(node);
      }
    }
  }
  
  // Recursive accumulation with memoization
  const calculated = new Set<string>();
  
  function accumulate(node: FlowNode): number {
    const key = `${node.x},${node.y}`;
    if (calculated.has(key)) {
      return node.flowAccumulation;
    }
    
    // Start with self
    let total = 1;
    
    // Add accumulation from all inflowing cells
    const inflowing = inflowMap.get(key) || [];
    for (const inflow of inflowing) {
      total += accumulate(inflow);
    }
    
    node.flowAccumulation = total;
    calculated.add(key);
    return total;
  }
  
  // Calculate for all cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      accumulate(flowMap[y][x]);
    }
  }
}

function selectRiverSources(
  heightMap: number[][],
  flowMap: FlowNode[][],
  rng: DeterministicRNG
): Vector2[] {
  const size = heightMap.length;
  const sources: Vector2[] = [];
  const minSourceElevation = MAX_ELEVATION * 0.5; // Rivers start in highlands
  const minDistanceBetweenSources = 30;
  
  // Create a list of potential source points
  const potentialSources: { point: Vector2; score: number }[] = [];
  
  for (let y = 10; y < size - 10; y++) {
    for (let x = 10; x < size - 10; x++) {
      const height = heightMap[y][x];
      
      // Must be high enough
      if (height < minSourceElevation || height <= SEA_LEVEL) continue;
      
      // Calculate score based on height and flow accumulation
      // Prefer high points with low accumulation (ridge lines)
      const flow = flowMap[y][x].flowAccumulation;
      const score = (height / MAX_ELEVATION) * (1 / Math.max(1, Math.log(flow + 1)));
      
      potentialSources.push({
        point: { x, y },
        score
      });
    }
  }
  
  // Sort by score and select sources with spacing
  potentialSources.sort((a, b) => b.score - a.score);
  
  const numRivers = rng.randomInt(4, 8); // 4-8 major rivers
  
  for (const candidate of potentialSources) {
    if (sources.length >= numRivers) break;
    
    // Check distance from existing sources
    let tooClose = false;
    for (const existing of sources) {
      if (distance(candidate.point, existing) < minDistanceBetweenSources) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      sources.push(candidate.point);
    }
  }
  
  return sources;
}

function traceRiverPaths(
  sources: Vector2[],
  flowMap: FlowNode[][],
  heightMap: number[][]
): RiverSegment[] {
  const segments: RiverSegment[] = [];
  const size = heightMap.length;
  
  for (const source of sources) {
    const points: RiverPoint[] = [];
    let current: FlowNode | null = flowMap[source.y][source.x];
    let flowAccumulation = current.flowAccumulation;
    
    // Trace path following flow directions
    const visited = new Set<string>();
    while (current) {
      const key = `${current.x},${current.y}`;
      if (visited.has(key)) break; // Prevent infinite loops
      visited.add(key);
      
      points.push({ x: current.x, y: current.y, width: 1 }); // Initial width
      
      // Update flow accumulation as we go downstream
      flowAccumulation = Math.max(flowAccumulation, current.flowAccumulation);
      
      const currentHeight = heightMap[current.y][current.x];
      
      // Continue until we reach deep ocean (not just beach/coast)
      if (currentHeight <= SEA_LEVEL * 0.5) {
        break;
      }
      
      // If we can't flow further but haven't reached ocean, try to extend toward ocean
      if (!current.flowsTo) {
        // Find the nearest ocean cell and extend the river there
        const oceanPoint = findNearestOcean(current.x, current.y, heightMap, size);
        if (oceanPoint && distance({ x: current.x, y: current.y }, oceanPoint) <= 5) {
          points.push({ x: oceanPoint.x, y: oceanPoint.y, width: 1 });
        }
        break;
      }
      
      current = current.flowsTo;
    }
    
    if (points.length > 5) { // Only keep rivers with meaningful length
      segments.push({
        points,
        streamOrder: 1, // Will be recalculated
        flowAccumulation
      });
    }
  }
  
  return segments;
}

function mergeRiverSystem(
  riverPaths: RiverSegment[],
  heightMap: number[][]
): RiverSegment[] {
  // Build a map of all river points
  const riverPointMap = new Map<string, {
    segments: RiverSegment[];
    point: Vector2;
  }>();
  
  for (const segment of riverPaths) {
    for (const point of segment.points) {
      const key = `${Math.floor(point.x)},${Math.floor(point.y)}`;
      if (!riverPointMap.has(key)) {
        riverPointMap.set(key, { segments: [], point });
      }
      riverPointMap.get(key)!.segments.push(segment);
    }
  }
  
  // Find merge points and update stream orders
  const mergedSegments: RiverSegment[] = [];
  const processed = new Set<RiverSegment>();
  
  for (const segment of riverPaths) {
    if (processed.has(segment)) continue;
    
    // Check if this segment merges with others
    let currentOrder = 1;
    let mergePoint: Vector2 | null = null;
    
    for (let i = segment.points.length - 1; i >= 0; i--) {
      const point = segment.points[i];
      const key = `${Math.floor(point.x)},${Math.floor(point.y)}`;
      const info = riverPointMap.get(key);
      
      if (info && info.segments.length > 1) {
        // Found a confluence
        const otherSegments = info.segments.filter(s => s !== segment);
        
        // Calculate new stream order (Strahler numbering)
        const orders = otherSegments.map(s => s.streamOrder);
        const maxOrder = Math.max(...orders, currentOrder);
        const sameOrderCount = orders.filter(o => o === maxOrder).length;
        
        if (sameOrderCount >= 2) {
          currentOrder = maxOrder + 1;
        } else {
          currentOrder = maxOrder;
        }
        
        mergePoint = point;
        
        // Mark other segments as processed if they end here
        for (const other of otherSegments) {
          if (other.points[other.points.length - 1] === point) {
            processed.add(other);
          }
        }
      }
    }
    
    segment.streamOrder = currentOrder;
    mergedSegments.push(segment);
    processed.add(segment);
  }
  
  return mergedSegments;
}

function calculateRiverWidths(
  segments: RiverSegment[],
  heightMap: number[][]
): RiverSegment[] {
  for (const segment of segments) {
    const points = segment.points;
    const totalPoints = points.length;
    
    for (let i = 0; i < totalPoints; i++) {
      const point = points[i];
      const height = heightMap[Math.floor(point.y)][Math.floor(point.x)];
      
      // Calculate progress along river (0 at source, 1 at mouth)
      const riverProgress = i / Math.max(1, totalPoints - 1);
      
      // Calculate distance to coast based on height
      const heightRatio = Math.max(0, (height - SEA_LEVEL) / (MAX_ELEVATION - SEA_LEVEL));
      
      // Base width on stream order (major factor)
      let width = segment.streamOrder * 0.8;
      
      // Add flow accumulation factor (logarithmic growth)
      const flowFactor = Math.log(segment.flowAccumulation + 1) / 12;
      width += flowFactor;
      
      // Progressive widening along the river course
      // Rivers start narrow and widen as they flow
      const progressWidening = riverProgress * 2.5;
      width += progressWidening;
      
      // Additional widening near coast (exponential near sea level)
      if (heightRatio < 0.3) {
        const coastalFactor = Math.pow(1 - (heightRatio / 0.3), 2);
        width += coastalFactor * 4;
      }
      
      // Subtle natural variation
      const variation = Math.sin(i * 0.15 + segment.streamOrder) * 0.2 + 1;
      width *= variation;
      
      // Ensure minimum width at source, maximum at mouth
      const minWidth = 0.5 + segment.streamOrder * 0.3;
      const maxWidth = 8 + segment.streamOrder * 2;
      
      point.width = clamp(width, minWidth, maxWidth);
    }
  }
  
  return segments;
}

function findConfluences(segments: RiverSegment[]): Vector2[] {
  const confluences: Vector2[] = [];
  const pointMap = new Map<string, number>();
  
  // Count how many segments pass through each point
  for (const segment of segments) {
    for (const point of segment.points) {
      const key = `${Math.floor(point.x)},${Math.floor(point.y)}`;
      pointMap.set(key, (pointMap.get(key) || 0) + 1);
    }
  }
  
  // Find points where multiple rivers meet
  for (const [key, count] of pointMap.entries()) {
    if (count > 1) {
      const [x, y] = key.split(',').map(Number);
      confluences.push({ x, y });
    }
  }
  
  return confluences;
}

// Helper function to smooth river paths for more natural appearance
function findNearestOcean(startX: number, startY: number, heightMap: number[][], size: number): Vector2 | null {
  // Simple BFS to find nearest ocean cell within reasonable distance
  const queue: Array<{x: number, y: number, dist: number}> = [{x: startX, y: startY, dist: 0}];
  const visited = new Set<string>();
  const maxDistance = 10; // Don't search too far
  
  while (queue.length > 0) {
    const {x, y, dist} = queue.shift()!;
    const key = `${x},${y}`;
    
    if (visited.has(key) || dist > maxDistance) continue;
    visited.add(key);
    
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const height = heightMap[y][x];
      if (height <= SEA_LEVEL * 0.5) {
        return {x, y};
      }
      
      // Add neighbors to queue
      for (const [dx, dy] of [[-1,0], [1,0], [0,-1], [0,1]]) {
        queue.push({x: x + dx, y: y + dy, dist: dist + 1});
      }
    }
  }
  
  return null;
}

export function smoothRiverPath(points: RiverPoint[], iterations: number = 2): RiverPoint[] {
  let smoothed = points.map(p => ({ ...p }));
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: RiverPoint[] = [{ ...smoothed[0] }]; // Keep first point
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      // Smooth position
      const smoothedX = (prev.x + curr.x * 2 + next.x) / 4;
      const smoothedY = (prev.y + curr.y * 2 + next.y) / 4;
      
      // Also smooth width for gradual transitions
      const smoothedWidth = (prev.width + curr.width * 2 + next.width) / 4;
      
      newPoints.push({
        x: smoothedX,
        y: smoothedY,
        width: smoothedWidth
      });
    }
    
    newPoints.push({ ...smoothed[smoothed.length - 1] }); // Keep last point
    smoothed = newPoints;
  }
  
  return smoothed;
}