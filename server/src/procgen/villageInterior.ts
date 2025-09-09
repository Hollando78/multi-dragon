import { DeterministicRNG } from './rng.js';

export interface Cell {
  type: 'grass' | 'road' | 'house' | 'tavern' | 'shop' | 'entrance' | 'door' | 'wall' | 'floor';
  walkable: boolean;
  sprite?: string;
}

export interface VillageEntity {
  id: string;
  type: 'villager' | 'merchant' | 'guard';
  position: { x: number; y: number };
  name: string;
  role: string;
  dialogue?: string[];
}

export interface VillageInterior {
  id: string;
  type: 'village';
  seed: string;
  width: number;
  height: number;
  layout: Cell[][];
  entities: VillageEntity[];
  entrance: { x: number; y: number };
}

export function generateVillageInterior(poiId: string, seed: string, rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common'): VillageInterior {
  const rng = new DeterministicRNG(seed);
  const scale = rarity === 'legendary' ? 1.6 : rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.15 : 1.0;
  const width = Math.max(28, Math.round(40 * scale));
  const height = Math.max(20, Math.round(30 * scale));

  // Initialize grass grid
  const layout: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: 'grass', walkable: true }))
  );

  // Create main road cross pattern
  const roadY = Math.floor(height / 2);
  const roadX = Math.floor(width / 2);
  
  // Horizontal road
  for (let x = 0; x < width; x++) {
    layout[roadY][x] = { type: 'road', walkable: true };
    layout[roadY - 1][x] = { type: 'road', walkable: true };
    layout[roadY + 1][x] = { type: 'road', walkable: true };
  }
  
  // Vertical road
  for (let y = 0; y < height; y++) {
    layout[y][roadX] = { type: 'road', walkable: true };
    layout[y][roadX - 1] = { type: 'road', walkable: true };
    layout[y][roadX + 1] = { type: 'road', walkable: true };
  }

  // Define entrance at bottom center
  const entrance = { x: roadX, y: height - 1 };
  layout[entrance.y][entrance.x] = { type: 'entrance', walkable: true };

  const entities: VillageEntity[] = [];

  // Simple name generation for unique-feeling NPCs per village
  const FIRST_NAMES = ['Aldric', 'Brina', 'Cedric', 'Daria', 'Edwin', 'Fiora', 'Garrick', 'Helena', 'Ilia', 'Joran', 'Kael', 'Lina', 'Marek', 'Nadia', 'Orin', 'Petra', 'Quinn', 'Rhea', 'Soren', 'Tess', 'Ulric', 'Vera', 'Willem', 'Yara', 'Zane'];
  const LAST_NAMES = ['Oakheart', 'Stonebrook', 'Rivers', 'Greenfield', 'Ashdown', 'Hawthorne', 'Brightwood', 'Ironford', 'Ravenhill', 'Stormwatch', 'Fairbairn', 'Meadows', 'Hillcrest', 'Longfellow'];
  const TAVERN_TITLES = ['Innkeeper', 'Host', 'Barkeep', 'Tavernmaster'];
  const MERCHANT_TITLES = ['Trader', 'Merchant', 'Shopkeeper', 'Peddler'];
  const pick = <T,>(arr: T[]) => arr[rng.randomInt(0, arr.length - 1)];
  const fullName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

  // Place buildings near roads
  const baseHouse = 4;
  const houseCount = rarity === 'legendary' ? baseHouse + 6 : rarity === 'epic' ? baseHouse + 4 : rarity === 'rare' ? baseHouse + 2 : baseHouse;
  const buildingConfigs = [
    { type: 'tavern', count: 1, name: 'The Prancing Pony' },
    { type: 'shop', count: 1, name: 'General Store' },
    { type: 'house', count: houseCount, name: 'House' }
  ];

  for (const config of buildingConfigs) {
    for (let i = 0; i < config.count; i++) {
      const building = placeBuildingNearRoad(layout, width, height, config.type, rng);
      if (building) {
        // Add NPC for tavern and shop
        if (config.type === 'tavern') {
          const tName = `${pick(TAVERN_TITLES)} ${fullName()}`;
          const lines = [
            'Welcome, traveler! Warm fire and good ale await.',
            'Rooms upstairs if you need rest.',
            'Watch the roads at night—wolves have been seen.'
          ];
          entities.push({
            id: rng.generateUUID('tavern-keeper'),
            type: 'merchant',
            position: { x: building.x + 1, y: building.y + 1 },
            name: tName,
            role: 'tavern_keeper',
            dialogue: rng.shuffle(lines).slice(0, 3)
          });
        } else if (config.type === 'shop') {
          const sName = `${pick(MERCHANT_TITLES)} ${fullName()}`;
          const lines = [
            'Fresh supplies and fair prices!',
            'Looking for something special?',
            'Coin on the counter, friend.'
          ];
          entities.push({
            id: rng.generateUUID('shopkeeper'),
            type: 'merchant',
            position: { x: building.x + 1, y: building.y + 1 },
            name: sName,
            role: 'shopkeeper',
            dialogue: rng.shuffle(lines).slice(0, 3)
          });
        } else if (config.type === 'house') {
          // Spawn 0-2 villagers per house with unique names
          const villagerCount = rng.randomInt(0, 2);
          for (let v = 0; v < villagerCount; v++) {
            entities.push({
              id: rng.generateUUID('villager-' + i + '-' + v),
              type: 'villager',
              position: { x: building.x + 1 + (v % 2), y: building.y + 1 },
              name: fullName(),
              role: 'villager',
              dialogue: rng.shuffle([
                'Lovely day, isn’t it?',
                'Have you visited the market?',
                'Mind the well, it’s deep.'
              ]).slice(0, 2)
            });
          }
        }
      }
    }
  }

  // Occasional village guards near the crossroads for flavor
  const guardCount = rng.randomInt(0, 2);
  for (let g = 0; g < guardCount; g++) {
    entities.push({
      id: rng.generateUUID('guard-' + g),
      type: 'guard',
      position: { x: roadX + (g === 0 ? -2 : 2), y: roadY },
      name: fullName(),
      role: 'guard',
      dialogue: ['Stay safe, citizen.']
    });
  }

  return {
    id: poiId,
    type: 'village',
    seed,
    width,
    height,
    layout,
    entities,
    entrance
  };
}

function placeBuildingNearRoad(
  layout: Cell[][], 
  width: number, 
  height: number, 
  buildingType: string, 
  rng: DeterministicRNG
): { x: number; y: number } | null {
  const buildingSize = 4; // 4x4 buildings
  const maxAttempts = 50;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = rng.randomInt(2, width - buildingSize - 2);
    const y = rng.randomInt(2, height - buildingSize - 2);
    
    // Check if area is clear and near a road
    let nearRoad = false;
    let areaClear = true;
    
    // Check building area
    for (let by = y; by < y + buildingSize && areaClear; by++) {
      for (let bx = x; bx < x + buildingSize && areaClear; bx++) {
        if (layout[by][bx].type !== 'grass') {
          areaClear = false;
        }
      }
    }
    // Enforce one-tile spacing margin around building
    for (let by = y - 1; by <= y + buildingSize && areaClear; by++) {
      for (let bx = x - 1; bx <= x + buildingSize && areaClear; bx++) {
        if (by < 0 || bx < 0 || by >= height || bx >= width) continue;
        if (by >= y && by < y + buildingSize && bx >= x && bx < x + buildingSize) continue;
        if (layout[by][bx].type !== 'grass' && layout[by][bx].type !== 'road') areaClear = false;
      }
    }
    
    // Check if near road (adjacent tiles)
    for (let by = y - 1; by <= y + buildingSize && !nearRoad; by++) {
      for (let bx = x - 1; bx <= x + buildingSize && !nearRoad; bx++) {
        if (by >= 0 && by < height && bx >= 0 && bx < width) {
          if (layout[by][bx].type === 'road') {
            nearRoad = true;
          }
        }
      }
    }
    
    if (areaClear && nearRoad) {
      // Place building
      for (let by = y; by < y + buildingSize; by++) {
        for (let bx = x; bx < x + buildingSize; bx++) {
          if (by === y || by === y + buildingSize - 1 || bx === x || bx === x + buildingSize - 1) {
            // Building walls
            layout[by][bx] = { type: 'wall', walkable: false };
          } else {
            // Interior floor
            layout[by][bx] = { type: 'floor', walkable: true };
          }
        }
      }
      
      // Add door on side closest to road
      const doorX = x + Math.floor(buildingSize / 2);
      const doorY = y + buildingSize - 1; // Door on bottom
      layout[doorY][doorX] = { type: 'door', walkable: true };
      
      return { x, y };
    }
  }
  
  return null; // Couldn't place building
}
