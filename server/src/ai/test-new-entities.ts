/**
 * Test Script for New Entity Behaviors
 * Tests all the newly added entity types and their specific behaviors
 */

import { EntityBehaviorSystem } from './EntityBehaviorSystem.js';

function testNewEntities() {
  console.log('🧙 Testing New Entity Behaviors...\n');
  
  // Create behavior system
  const system = new EntityBehaviorSystem();
  
  // Test all new entity types
  const newEntityTypes = [
    // Wizard Tower
    { type: 'adept', name: 'Magic Adept' },
    { type: 'archmage', name: 'Powerful Archmage' },
    
    // Town NPCs
    { type: 'innkeeper', name: 'Friendly Innkeeper' },
    { type: 'blacksmith', name: 'Master Blacksmith' },
    { type: 'alchemist', name: 'Wise Alchemist' },
    { type: 'banker', name: 'Trustworthy Banker' },
    { type: 'librarian', name: 'Learned Librarian' },
    { type: 'priest', name: 'Holy Priest' },
    
    // Ancient Circle
    { type: 'druid', name: 'Nature Druid' },
    
    // Dragon entities
    { type: 'dragon', name: 'Ancient Dragon' },
    { type: 'junior_dragon', name: 'Young Dragon' },
    { type: 'thrall', name: 'Dragon Thrall' },
    { type: 'prisoner', name: 'Captive Prisoner' },
    
    // Lighthouse
    { type: 'keeper', name: 'Lighthouse Keeper' },
    
    // Static entities
    { type: 'megalith', name: 'Standing Stone' },
    { type: 'altar', name: 'Ritual Altar' },
    { type: 'portal', name: 'Ancient Portal' },
    { type: 'dragon_egg', name: 'Dragon Egg' }
  ];
  
  // Add all test entities
  newEntityTypes.forEach((entity, i) => {
    const position = {
      x: 10 + (i % 5) * 5, // Spread them out in a grid
      y: 10 + Math.floor(i / 5) * 5
    };
    system.addEntity(`${entity.type}-test`, entity.type, position, 'test-location');
    
    const entityData = system.getEntityData(`${entity.type}-test`);
    const disposition = entityData?.disposition;
    
    console.log(`✅ Added ${entity.name} (${entity.type}) - Disposition: ${disposition}`);
  });
  
  console.log(`\n📊 System stats: ${JSON.stringify(system.getStats())}`);
  
  // Mock world state
  const worldState = {
    playersInPOI: {},
    timestamp: Date.now()
  };
  
  // Run simulation for 8 seconds to observe behaviors
  console.log('\n🎮 Running 8-second behavior observation...\n');
  
  const startTime = Date.now();
  const simulationDuration = 8000;
  const updateInterval = 500; // 500ms updates
  
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
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      
      for (const update of updates) {
        const entityType = update.entityId.replace('-test', '');
        const pos = update.position;
        
        // Show behavior patterns based on entity type
        let behaviorNote = '';
        if (['adept', 'archmage'].includes(entityType)) {
          behaviorNote = '📚 STUDYING';
        } else if (['innkeeper', 'blacksmith', 'alchemist', 'banker', 'librarian'].includes(entityType)) {
          behaviorNote = '🏪 WORKING';
        } else if (entityType === 'priest') {
          behaviorNote = '🙏 PRAYING';
        } else if (entityType === 'druid') {
          behaviorNote = '🌿 NATURE COMMUNION';
        } else if (entityType === 'dragon') {
          behaviorNote = '🐉 TERRITORIAL';
        } else if (entityType === 'junior_dragon') {
          behaviorNote = '🐲 RESTLESS';
        } else if (entityType === 'thrall') {
          behaviorNote = '⚔️ SERVING';
        } else if (entityType === 'prisoner') {
          behaviorNote = '😔 DEJECTED';
        } else if (entityType === 'keeper') {
          behaviorNote = '🗼 WATCHING';
        } else if (['megalith', 'altar', 'portal', 'dragon_egg'].includes(entityType)) {
          behaviorNote = '🗿 STATIC';
        }
        
        console.log(`⚡ [${elapsed}s] ${entityType}: ${behaviorNote} at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
      }
    }
    
    // Log status every 2 seconds
    if (updateCount % 4 === 0) {
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      console.log(`\n📍 Status at ${elapsed}s - Active entities: ${updates.length}\n`);
    }
    
    // Continue simulation
    if (now - startTime < simulationDuration) {
      setTimeout(runUpdate, updateInterval);
    } else {
      console.log('\n🏁 New entity behavior test complete!');
      console.log('📊 Final stats:', system.getStats());
      
      // Show behavior summary
      console.log('\n📋 Behavior Summary:');
      newEntityTypes.forEach(entity => {
        const entityData = system.getEntityData(`${entity.type}-test`);
        if (entityData) {
          const pos = entityData.blackboard.get<{x: number, y: number}>('position');
          const disp = entityData.disposition;
          if (pos) {
            console.log(`  ${entity.name}: ${disp} - Final pos (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
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
  testNewEntities();
}