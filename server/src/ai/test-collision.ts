/**
 * Test Script for Collision Detection
 * Tests that entities respect walls and boundaries
 */

import { EntityBehaviorSystem } from './EntityBehaviorSystem.js';

function testCollisionDetection() {
  console.log('🧱 Testing Collision Detection...\n');
  
  // Create behavior system
  const system = new EntityBehaviorSystem();
  
  // Mock POI layout (simple room with walls)
  const mockLayout = [
    [{ type: 'wall', walkable: false }, { type: 'wall', walkable: false }, { type: 'wall', walkable: false }, { type: 'wall', walkable: false }, { type: 'wall', walkable: false }],
    [{ type: 'wall', walkable: false }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'wall', walkable: false }],
    [{ type: 'wall', walkable: false }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'wall', walkable: false }],
    [{ type: 'wall', walkable: false }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'floor', walkable: true }, { type: 'wall', walkable: false }],
    [{ type: 'wall', walkable: false }, { type: 'wall', walkable: false }, { type: 'entrance', walkable: true }, { type: 'wall', walkable: false }, { type: 'wall', walkable: false }]
  ];
  
  const poiLayouts = new Map();
  poiLayouts.set('test-room', mockLayout);
  
  // Add test entities
  system.addEntity('villager-1', 'villager', { x: 2, y: 2 }, 'test-room'); // Start in walkable area
  system.addEntity('villager-2', 'villager', { x: 1.5, y: 1.5 }, 'test-room'); // Near wall
  system.addEntity('bat-1', 'bat', { x: 3, y: 3 }, 'test-room'); // Bat can fly over walls
  
  console.log('✅ Added test entities in a 5x5 room with walls');
  console.log('Layout:');
  console.log('█████');
  console.log('█   █');  
  console.log('█   █');
  console.log('█   █');
  console.log('██ ██');
  console.log('(█ = wall, space = floor, 2 = entrance)');
  
  // Mock world state
  const worldState = {
    playersInPOI: {},
    timestamp: Date.now()
  };
  
  // Run simulation for 10 seconds
  console.log('\n🎮 Running 10-second collision test...\n');
  
  const startTime = Date.now();
  const simulationDuration = 10000;
  const updateInterval = 200; // 200ms updates for easier observation
  
  let lastUpdate = startTime;
  let updateCount = 0;
  
  const runUpdate = () => {
    const now = Date.now();
    const deltaTime = now - lastUpdate;
    lastUpdate = now;
    
    // Update entities with layout data
    const updates = system.update(deltaTime, worldState, poiLayouts);
    updateCount++;
    
    if (updates.length > 0) {
      const elapsed = ((now - startTime)/1000).toFixed(1);
      
      for (const update of updates) {
        const pos = update.position;
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        
        // Check if position would be valid
        const cell = mockLayout[y]?.[x];
        const valid = cell?.walkable === true;
        const status = valid ? '✅' : '❌';
        
        console.log(`${status} [${elapsed}s] ${update.entityId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) -> cell[${y}][${x}] = ${cell?.type || 'OOB'}`);
      }
    }
    
    // Continue simulation
    if (now - startTime < simulationDuration) {
      setTimeout(runUpdate, updateInterval);
    } else {
      console.log('\n🏁 Collision test complete!');
      console.log('📊 Final stats:', system.getStats());
      
      // Final position check
      console.log('\n📍 Final positions:');
      ['villager-1', 'villager-2', 'bat-1'].forEach(entityId => {
        const entityData = system.getEntityData(entityId);
        if (entityData) {
          const pos = entityData.blackboard.get<{x: number, y: number}>('position');
          if (pos) {
            const x = Math.floor(pos.x);
            const y = Math.floor(pos.y);
            const cell = mockLayout[y]?.[x];
            const valid = cell?.walkable === true || entityId.includes('bat'); // Bats can fly over walls
            const status = valid ? '✅' : '❌';
            
            console.log(`${status} ${entityId}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) on ${cell?.type || 'OOB'}`);
          }
        }
      });
      
      system.destroy();
    }
  };
  
  runUpdate();
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCollisionDetection();
}