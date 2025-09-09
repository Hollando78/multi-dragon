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
          entities.push({
            id: rng.generateUUID('tavern-keeper'),
            type: 'merchant',
            position: { x: building.x + 1, y: building.y + 1 },
            name: 'Innkeeper Barliman',
            role: 'tavern_keeper',
            dialogue: [
              "Welcome to the Prancing Pony!",
              "Would you like a room for the night?",
              "The ale here is the finest in the village!"
            ]
          });
        } else if (config.type === 'shop') {
          entities.push({
            id: rng.generateUUID('shopkeeper'),
            type: 'merchant',
            position: { x: building.x + 1, y: building.y + 1 },
            name: 'Merchant Took',
            role: 'shopkeeper',
            dialogue: [
              "Welcome to my shop!",
              "I have the finest goods this side of the mountains.",
              "What can I get for you today?"
            ]
          });
        } else if (config.type === 'house' && i === 0) {
          // Add a villager to the first house
          entities.push({
            id: rng.generateUUID('villager-' + i),
            type: 'villager',
            position: { x: building.x + 1, y: building.y + 1 },
            name: 'Villager ' + rng.randomElement(['Tom', 'Mary', 'John', 'Sarah', 'Bob']),
            role: 'villager',
            dialogue: [
              "Hello, traveler!",
              "Welcome to Haven Village.",
              "The weather has been quite lovely lately."
            ]
          });
        }
      }
    }
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
