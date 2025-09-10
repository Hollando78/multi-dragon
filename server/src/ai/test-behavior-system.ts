/**
 * Test Script for Entity Behavior System
 * Demonstrates the core functionality of the behavior tree system
 */

import { EntityBehaviorSystem } from './EntityBehaviorSystem.js';

function testBehaviorSystem() {
  console.log('🧪 Testing Entity Behavior System...\n');
  
  // Create behavior system
  const system = new EntityBehaviorSystem();
  
  // Add test entities
  system.addEntity('villager-1', 'villager', { x: 10, y: 10 }, 'test-village');
  system.addEntity('guard-1', 'guard', { x: 15, y: 15 }, 'test-castle');
  system.addEntity('merchant-1', 'merchant', { x: 20, y: 20 }, 'test-town');
  
  console.log('✅ Added 3 test entities');
  console.log('📊 System stats:', system.getStats());
  
  // Mock world state with no players initially
  let worldState = {
    playersInPOI: {},
    timestamp: Date.now()
  };
  
  // Run simulation for 10 seconds
  console.log('\n🎮 Running 10-second simulation...\n');
  
  const startTime = Date.now();
  const simulationDuration = 10000; // 10 seconds
  const updateInterval = 100; // 100ms updates
  
  let lastUpdate = startTime;
  
  const runUpdate = () => {
    const now = Date.now();
    const deltaTime = now - lastUpdate;
    lastUpdate = now;
    
    // Update entities
    const updates = system.update(deltaTime, worldState);
    
    if (updates.length > 0) {
      console.log(`⚡ [${((now - startTime)/1000).toFixed(1)}s] Entity updates:`, 
                  updates.map(u => `${u.entityId}: (${u.position.x.toFixed(1)}, ${u.position.y.toFixed(1)})`).join(', '));
    }
    
    // Continue simulation
    if (now - startTime < simulationDuration) {
      setTimeout(runUpdate, updateInterval);
    } else {
      console.log('\n🏁 Simulation complete!');
      
      // Add a mock player after 5 seconds to test reactions
      console.log('\n👤 Adding mock player to test entity reactions...\n');
      
      worldState.playersInPOI = {
        'test-village': [{ id: 'player-1', position: { x: 12, y: 12 }, name: 'TestPlayer' }]
      };
      
      // Run a few more updates with player present
      let playerTestCount = 0;
      const playerTest = () => {
        const now = Date.now();
        const updates = system.update(100, worldState);
        
        if (updates.length > 0) {
          console.log(`👥 [Player Present] Entity updates:`, 
                      updates.map(u => `${u.entityId}: (${u.position.x.toFixed(1)}, ${u.position.y.toFixed(1)})`).join(', '));
        }
        
        playerTestCount++;
        if (playerTestCount < 20) { // 2 seconds worth
          setTimeout(playerTest, 100);
        } else {
          console.log('\n✅ Behavior system test completed successfully!');
          console.log('📊 Final stats:', system.getStats());
          system.destroy();
        }
      };
      
      playerTest();
    }
  };
  
  runUpdate();
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBehaviorSystem();
}