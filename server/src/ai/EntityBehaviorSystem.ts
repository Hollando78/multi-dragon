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
      case 'villager':
      case 'merchant':
        return Disposition.FRIENDLY;
      case 'guard':
        return Disposition.NEUTRAL;
      case 'bandit':
      case 'dragon':
        return Disposition.HOSTILE;
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