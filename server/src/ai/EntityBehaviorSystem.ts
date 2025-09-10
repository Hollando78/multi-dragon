/**
 * Entity Behavior System - Main coordinator
 * Manages all entity behaviors and synchronization
 */

import { BehaviorTree, Blackboard, BehaviorContext, NodeStatus, SequenceNode, SelectorNode, RepeatNode } from './BehaviorTree.js';
import { 
  IdleAction, MoveToPositionAction, SetRandomTargetPositionAction,
  IsPlayerNearbyCondition, IsAtPositionCondition,
  LogAction,
  SetWallTargetAction, PerchAction, FlyToPositionAction
} from './BehaviorNodes.js';

export enum Disposition {
  FRIENDLY = 'friendly',
  NEUTRAL = 'neutral', 
  HOSTILE = 'hostile',
  FEARFUL = 'fearful'
}

export interface EntityBehaviorData {
  entityId: string;
  behaviorTree: BehaviorTree;
  blackboard: Blackboard;
  disposition: Disposition;
  lastUpdate: number;
  needsSync: boolean; // Flag for client synchronization
}

export interface EntityUpdateData {
  entityId: string;
  position: { x: number; y: number };
  facing?: number;
  animation?: string;
  disposition: Disposition;
}

export class EntityBehaviorSystem {
  private entities: Map<string, EntityBehaviorData> = new Map();
  private updateInterval: number = 100; // ms between updates
  private lastGlobalUpdate: number = 0;
  
  constructor() {
    console.log('🧠 EntityBehaviorSystem initialized');
  }
  
  // Add entity to behavior system
  addEntity(entityId: string, entityType: string, position: { x: number; y: number }, poiId?: string): void {
    if (this.entities.has(entityId)) {
      console.warn(`Entity ${entityId} already exists in behavior system`);
      return;
    }
    
    const blackboard = new Blackboard();
    const behaviorTree = this.createBehaviorTreeForType(entityType);
    const disposition = this.getDefaultDisposition(entityType);
    
    // Initialize blackboard with entity data
    blackboard.set('position', position);
    blackboard.set('entityType', entityType);
    blackboard.set('poiId', poiId);
    blackboard.set('nearbyPlayers', []);
    blackboard.set('health', 100);
    blackboard.set('maxHealth', 100);
    
    const entityData: EntityBehaviorData = {
      entityId,
      behaviorTree,
      blackboard,
      disposition,
      lastUpdate: Date.now(),
      needsSync: true
    };
    
    this.entities.set(entityId, entityData);
    console.log(`✅ Added entity ${entityId} (${entityType}) to behavior system`);
  }
  
  // Remove entity from system
  removeEntity(entityId: string): void {
    if (this.entities.delete(entityId)) {
      console.log(`🗑️ Removed entity ${entityId} from behavior system`);
    }
  }
  
  // Update all entity behaviors
  update(deltaTime: number, worldState: any, poiLayouts?: Map<string, any[][]>): EntityUpdateData[] {
    const now = Date.now();
    const updates: EntityUpdateData[] = [];
    
    // Only update if enough time has passed
    if (now - this.lastGlobalUpdate < this.updateInterval) {
      return updates;
    }
    
    this.lastGlobalUpdate = now;
    
    // Debug: Log update activity every 5 seconds
    if (this.entities.size > 0 && now % 5000 < this.updateInterval) {
      console.log(`🧠 Updating ${this.entities.size} entities...`);
    }
    
    for (const [entityId, entityData] of this.entities) {
      try {
        // Get POI layout for this entity
        const poiId = entityData.blackboard.get<string>('poiId');
        const layout = poiId ? poiLayouts?.get(poiId) : undefined;
        
        const context: BehaviorContext = {
          entityId,
          blackboard: entityData.blackboard,
          deltaTime: now - entityData.lastUpdate,
          worldState,
          poiLayout: layout
        };
        
        // Update nearby players from world state
        this.updateEntitySensors(entityData, worldState);
        
        // Execute behavior tree
        const status = entityData.behaviorTree.tick(context);
        entityData.lastUpdate = now;
        
        // Check if entity needs client synchronization
        if (entityData.blackboard.get('needsPositionUpdate') || entityData.needsSync) {
          const position = entityData.blackboard.get<{x: number, y: number}>('position');
          const facing = entityData.blackboard.get<number>('facing');
          
          if (position) {
            updates.push({
              entityId,
              position,
              facing,
              disposition: entityData.disposition
            });
            
            // Debug: Log entity updates occasionally
            if (Math.random() < 0.1) { // 10% chance per update
              console.log(`📍 Entity ${entityId} (${entityData.blackboard.get('entityType')}) moved to (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            }
            
            entityData.blackboard.delete('needsPositionUpdate');
            entityData.needsSync = false;
          }
        }
        
      } catch (error) {
        console.error(`❌ Error updating entity ${entityId}:`, error);
      }
    }
    
    return updates;
  }
  
  // Update entity's sensor data (nearby players, etc.)
  private updateEntitySensors(entityData: EntityBehaviorData, worldState: any): void {
    const entityPosition = entityData.blackboard.get<{x: number, y: number}>('position');
    const poiId = entityData.blackboard.get<string>('poiId');
    
    // Always set an empty array for now - entities will still move without players
    let nearbyPlayers: any[] = [];
    
    if (entityPosition && worldState.playersInPOI && poiId) {
      const playersInPOI = worldState.playersInPOI[poiId] || [];
      const sensorRange = 10; // tiles
      
      nearbyPlayers = playersInPOI.filter((player: any) => {
        if (!player.position) return false;
        
        const distance = Math.hypot(
          player.position.x - entityPosition.x,
          player.position.y - entityPosition.y
        );
        
        return distance <= sensorRange;
      });
    }
    
    entityData.blackboard.set('nearbyPlayers', nearbyPlayers);
  }
  
  // Create behavior tree based on entity type
  private createBehaviorTreeForType(entityType: string): BehaviorTree {
    switch (entityType) {
      case 'villager':
        return this.createVillagerBehavior();
      case 'guard':
        return this.createGuardBehavior();
      case 'merchant':
        return this.createMerchantBehavior();
      case 'bat':
        return this.createBatBehavior();
      case 'slime':
        return this.createSlimeBehavior();
      
      // Wizard Tower entities
      case 'adept':
        return this.createAdeptBehavior();
      case 'archmage':
        return this.createArchmageBehavior();
      
      // Town/Village NPCs
      case 'innkeeper':
      case 'blacksmith':
      case 'alchemist':
      case 'banker':
      case 'librarian':
        return this.createShopkeeperBehavior();
      case 'priest':
        return this.createPriestBehavior();
      
      // Ancient Circle
      case 'druid':
        return this.createDruidBehavior();
      
      // Dragon entities
      case 'dragon':
        return this.createDragonBehavior();
      case 'junior_dragon':
        return this.createJuniorDragonBehavior();
      case 'thrall':
        return this.createThrallBehavior();
      case 'prisoner':
        return this.createPrisonerBehavior();
      
      // Lighthouse
      case 'keeper':
        return this.createKeeperBehavior();
      
      // Static entities (minimal movement)
      case 'megalith':
      case 'altar':
      case 'portal':
      case 'boat':
      case 'dragon_egg':
      case 'gold_pile':
        return this.createStaticBehavior();
      
      default:
        return this.createDefaultBehavior();
    }
  }
  
  // Behavior tree for villagers (simple wandering)
  private createVillagerBehavior(): BehaviorTree {
    const root = new RepeatNode(); // Repeat forever
    
    const wanderSequence = new SequenceNode();
    wanderSequence.addChild(new SetRandomTargetPositionAction(5)); // Wander within 5 tiles
    wanderSequence.addChild(new MoveToPositionAction(1.5)); // Move at 1.5 tiles/sec
    wanderSequence.addChild(new IdleAction(3000)); // Idle for 3 seconds
    
    root.addChild(wanderSequence);
    
    return new BehaviorTree(root);
  }
  
  // Behavior tree for guards (patrol and respond to threats)
  private createGuardBehavior(): BehaviorTree {
    const root = new RepeatNode();
    
    const mainSelector = new SelectorNode();
    
    // Priority 1: Respond to nearby players
    const respondToPlayers = new SequenceNode();
    respondToPlayers.addChild(new IsPlayerNearbyCondition(3));
    respondToPlayers.addChild(new LogAction('Player detected!'));
    respondToPlayers.addChild(new IdleAction(1000)); // Stand alert
    
    // Priority 2: Default patrol behavior
    const patrolSequence = new SequenceNode();
    patrolSequence.addChild(new SetRandomTargetPositionAction(3));
    patrolSequence.addChild(new MoveToPositionAction(1.0));
    patrolSequence.addChild(new IdleAction(2000));
    
    mainSelector.addChild(respondToPlayers);
    mainSelector.addChild(patrolSequence);
    root.addChild(mainSelector);
    
    return new BehaviorTree(root);
  }
  
  // Behavior tree for merchants (idle mostly, react to players)
  private createMerchantBehavior(): BehaviorTree {
    const root = new RepeatNode();
    
    const mainSelector = new SelectorNode();
    
    // Priority 1: Greet nearby players
    const greetPlayers = new SequenceNode();
    greetPlayers.addChild(new IsPlayerNearbyCondition(2));
    greetPlayers.addChild(new LogAction('Welcome! Come see my wares!'));
    greetPlayers.addChild(new IdleAction(5000));
    
    // Priority 2: Just idle
    const defaultIdle = new IdleAction(10000);
    
    mainSelector.addChild(greetPlayers);
    mainSelector.addChild(defaultIdle);
    root.addChild(mainSelector);
    
    return new BehaviorTree(root);
  }
  
  // Behavior tree for bats (fly to wall, perch, repeat)
  private createBatBehavior(): BehaviorTree {
    const root = new RepeatNode(); // Repeat forever
    
    const batSequence = new SequenceNode();
    
    // Find a wall to fly to
    batSequence.addChild(new SetWallTargetAction());
    
    // Fly to the wall
    batSequence.addChild(new FlyToPositionAction(5.0)); // Fast flying speed
    
    // Perch on the wall for a random duration
    const perchDuration = 2000 + Math.random() * 4000; // 2-6 seconds
    batSequence.addChild(new PerchAction(perchDuration));
    
    root.addChild(batSequence);
    
    return new BehaviorTree(root);
  }
  
  // Behavior tree for slimes (slow wandering)
  private createSlimeBehavior(): BehaviorTree {
    const root = new RepeatNode(); // Repeat forever
    
    const slimeSequence = new SequenceNode();
    
    // Slimes move slowly and randomly
    slimeSequence.addChild(new SetRandomTargetPositionAction(2)); // Smaller wander range
    slimeSequence.addChild(new MoveToPositionAction(0.5)); // Very slow movement
    slimeSequence.addChild(new IdleAction(1500)); // Brief pause
    
    root.addChild(slimeSequence);
    
    return new BehaviorTree(root);
  }
  
  // Behavior tree for adepts (study/research patterns)
  private createAdeptBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Adepts study, then wander briefly, then study more
    sequence.addChild(new IdleAction(3000)); // Study/research
    sequence.addChild(new SetRandomTargetPositionAction(3)); // Small movements around study area
    sequence.addChild(new MoveToPositionAction(0.8));
    sequence.addChild(new IdleAction(2000)); // More study
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for archmages (slower, more purposeful movement)
  private createArchmageBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Archmages move very deliberately with long pauses for contemplation
    sequence.addChild(new IdleAction(5000)); // Deep contemplation
    sequence.addChild(new SetRandomTargetPositionAction(2)); // Minimal movement
    sequence.addChild(new MoveToPositionAction(0.6)); // Slow, dignified pace
    sequence.addChild(new IdleAction(8000)); // Extended periods of stillness
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for shopkeepers (stay near their stations)
  private createShopkeeperBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Shopkeepers mostly stay put, occasionally organizing their space
    sequence.addChild(new IdleAction(4000)); // Tend to customers/work
    sequence.addChild(new SetRandomTargetPositionAction(1.5)); // Stay very close to station
    sequence.addChild(new MoveToPositionAction(0.7));
    sequence.addChild(new IdleAction(6000)); // Back to work
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for priests (prayer and blessing patterns)
  private createPriestBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Priests pray, move contemplatively, and return to prayer
    sequence.addChild(new IdleAction(6000)); // Prayer/meditation
    sequence.addChild(new SetRandomTargetPositionAction(2)); // Contemplative movement
    sequence.addChild(new MoveToPositionAction(0.5)); // Slow, reverent pace
    sequence.addChild(new IdleAction(4000)); // More prayer
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for druids (nature-attuned movement)
  private createDruidBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Druids move in harmony with nature, with ritual pauses
    sequence.addChild(new IdleAction(3000)); // Commune with nature
    sequence.addChild(new SetRandomTargetPositionAction(4)); // Move around the circle
    sequence.addChild(new MoveToPositionAction(0.7)); // Natural pace
    sequence.addChild(new IdleAction(5000)); // Extended nature communion
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for dragons (territorial, menacing)
  private createDragonBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Dragons are territorial and move with power and menace
    sequence.addChild(new IdleAction(8000)); // Brood and watch
    sequence.addChild(new SetRandomTargetPositionAction(6)); // Patrol territory
    sequence.addChild(new MoveToPositionAction(1.2)); // Powerful, deliberate movement
    sequence.addChild(new IdleAction(12000)); // Long periods of watching/guarding
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for junior dragons (more active than adults)
  private createJuniorDragonBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Young dragons are more restless and active
    sequence.addChild(new IdleAction(3000)); // Brief rest
    sequence.addChild(new SetRandomTargetPositionAction(5)); // More active movement
    sequence.addChild(new MoveToPositionAction(1.0)); // Energetic pace
    sequence.addChild(new IdleAction(4000)); // Shorter rest periods
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for thralls (servant-like movement)
  private createThrallBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Thralls move efficiently as servants, with brief pauses
    sequence.addChild(new IdleAction(2000)); // Brief pause
    sequence.addChild(new SetRandomTargetPositionAction(4)); // Move to serve
    sequence.addChild(new MoveToPositionAction(0.9)); // Purposeful pace
    sequence.addChild(new IdleAction(1500)); // Quick tasks
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for prisoners (dejected, limited movement)
  private createPrisonerBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Prisoners move little, with dejected posture and long pauses
    sequence.addChild(new IdleAction(8000)); // Long periods of despair
    sequence.addChild(new SetRandomTargetPositionAction(1)); // Very limited movement
    sequence.addChild(new MoveToPositionAction(0.3)); // Slow, dejected pace
    sequence.addChild(new IdleAction(12000)); // Extended periods of stillness
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for lighthouse keeper (watching the seas)
  private createKeeperBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Keeper maintains the lighthouse with regular patrols
    sequence.addChild(new IdleAction(5000)); // Watch the horizon
    sequence.addChild(new SetRandomTargetPositionAction(3)); // Check equipment
    sequence.addChild(new MoveToPositionAction(0.7)); // Dutiful pace
    sequence.addChild(new IdleAction(7000)); // Extended watching
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }
  
  // Behavior tree for static entities (almost no movement)
  private createStaticBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const sequence = new SequenceNode();
    
    // Static objects occasionally have very minor positional adjustments
    sequence.addChild(new IdleAction(30000)); // Very long idle periods
    sequence.addChild(new SetRandomTargetPositionAction(0.1)); // Minimal movement
    sequence.addChild(new MoveToPositionAction(0.1)); // Very slow adjustment
    
    root.addChild(sequence);
    return new BehaviorTree(root);
  }

  // Default behavior for unknown entity types
  private createDefaultBehavior(): BehaviorTree {
    const root = new RepeatNode();
    const idleAction = new IdleAction(5000);
    root.addChild(idleAction);
    
    return new BehaviorTree(root);
  }
  
  // Get default disposition for entity type
  private getDefaultDisposition(entityType: string): Disposition {
    switch (entityType) {
      // Friendly entities
      case 'villager':
      case 'merchant':
      case 'innkeeper':
      case 'blacksmith':
      case 'alchemist':
      case 'banker':
      case 'librarian':
      case 'priest':
      case 'keeper':
        return Disposition.FRIENDLY;
      
      // Neutral entities  
      case 'guard':
      case 'adept':
      case 'archmage':
      case 'druid':
      case 'thrall':
        return Disposition.NEUTRAL;
      
      // Hostile entities
      case 'bandit':
      case 'dragon':
      case 'junior_dragon':
        return Disposition.HOSTILE;
      
      // Special cases
      case 'prisoner':
        return Disposition.FRIENDLY; // Prisoners are grateful for help
      case 'bat':
      case 'slime':
        return Disposition.NEUTRAL; // Animals/creatures
      
      // Static entities are neutral
      case 'megalith':
      case 'altar':
      case 'portal':
      case 'boat':
      case 'dragon_egg':
      case 'gold_pile':
        return Disposition.NEUTRAL;
      
      default:
        return Disposition.NEUTRAL;
    }
  }
  
  // Get entity data (for debugging/monitoring)
  getEntityData(entityId: string): EntityBehaviorData | undefined {
    return this.entities.get(entityId);
  }
  
  // Get all entities in a POI
  getEntitiesInPOI(poiId: string): EntityBehaviorData[] {
    const entities: EntityBehaviorData[] = [];
    
    for (const entityData of this.entities.values()) {
      if (entityData.blackboard.get('poiId') === poiId) {
        entities.push(entityData);
      }
    }
    
    return entities;
  }
  
  // Get system stats
  getStats(): { totalEntities: number; entitiesNeedingSync: number } {
    let entitiesNeedingSync = 0;
    
    for (const entityData of this.entities.values()) {
      if (entityData.needsSync || entityData.blackboard.get('needsPositionUpdate')) {
        entitiesNeedingSync++;
      }
    }
    
    return {
      totalEntities: this.entities.size,
      entitiesNeedingSync
    };
  }
  
  // Cleanup
  destroy(): void {
    this.entities.clear();
    console.log('🧠 EntityBehaviorSystem destroyed');
  }
}