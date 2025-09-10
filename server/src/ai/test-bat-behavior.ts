/**
 * Test Script for Bat Behavior
 * Demonstrates bats flying to walls and perching
 */

import { EntityBehaviorSystem } from './EntityBehaviorSystem.js';

function testBatBehavior() {
  console.log('🦇 Testing Bat Behavior System...\n');
  
  // Create behavior system
  const system = new EntityBehaviorSystem();
  
  // Add test bats
  const numBats = 3;
  for (let i = 0; i < numBats; i++) {
    const startPos = { 
      x: 20 + Math.random() * 10, 
      y: 20 + Math.random() * 10 
    };
    system.addEntity(`bat-${i}`, 'bat', startPos, 'test-cave');
  }
  
  // Add a slime for comparison
  system.addEntity('slime-1', 'slime', { x: 15, y: 15 }, 'test-cave');
  
  console.log('✅ Added 3 bats and 1 slime');
  console.log('📊 System stats:', system.getStats());
  
  // Mock world state
  let worldState = {
    playersInPOI: {},
    timestamp: Date.now()
  };
  
  // Run simulation for 15 seconds
  console.log('\n🎮 Running 15-second simulation...\n');
  
  const startTime = Date.now();
  const simulationDuration = 15000; // 15 seconds
  const updateInterval = 100; // 100ms updates
  
  let lastUpdate = startTime;
  let updateCount = 0;
  
  const runUpdate = () => {
    const now = Date.now();
    const deltaTime = now - lastUpdate;
    lastUpdate = now;
    
    // Update entities
    const updates = system.update(deltaTime, worldState);
    updateCount++;
    
    if (updates.length > 0) {
      const elapsed = ((now - startTime)/1000).toFixed(1);
      
      for (const update of updates) {
        const entityData = system.getEntityData(update.entityId);
        const isFlying = entityData?.blackboard.get('isFlying');
        const isPerching = entityData?.blackboard.get('isPerching');
        
        const state = isPerching ? '🦇 PERCHED' : 
                     isFlying ? '🦇 FLYING' : 
                     update.entityId.includes('slime') ? '🟢 SLIMING' : '❓';
        
        console.log(`⚡ [${elapsed}s] ${update.entityId}: ${state} at (${update.position.x.toFixed(1)}, ${update.position.y.toFixed(1)})`);
      }
    }
    
    // Log periodic status every 3 seconds
    if (updateCount % 30 === 0) {
      console.log(`\n📍 Status at ${((now - startTime)/1000).toFixed(1)}s:`);
      for (let i = 0; i < numBats; i++) {
        const batData = system.getEntityData(`bat-${i}`);
        if (batData) {
          const pos = batData.blackboard.get<{x: number, y: number}>('position');
          const isFlying = batData.blackboard.get('isFlying');
          const isPerching = batData.blackboard.get('isPerching');
          
          if (pos) {
            console.log(`  bat-${i}: ${isPerching ? 'Perching' : isFlying ? 'Flying' : 'Transitioning'} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
          }
        }
      }
      console.log('');
    }
    
    // Continue simulation
    if (now - startTime < simulationDuration) {
      setTimeout(runUpdate, updateInterval);
    } else {
      console.log('\n🏁 Simulation complete!');
      console.log('📊 Final stats:', system.getStats());
      
      // Final positions
      console.log('\n📍 Final positions:');
      for (let i = 0; i < numBats; i++) {
        const batData = system.getEntityData(`bat-${i}`);
        if (batData) {
          const pos = batData.blackboard.get<{x: number, y: number}>('position');
          const isPerching = batData.blackboard.get('isPerching');
          if (pos) {
            console.log(`  bat-${i}: ${isPerching ? 'Perched' : 'Not perched'} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
          }
        }
      }
      
      system.destroy();
    }
  };
  
  runUpdate();
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBatBehavior();
}