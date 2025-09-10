/**
 * Behavior Tree Leaf Nodes - Actions and Conditions
 * Extensible library of reusable behavior components
 */

import { BehaviorNode, NodeStatus, BehaviorContext } from './BehaviorTree.js';

// Base classes for different node types
export abstract class ActionNode extends BehaviorNode {
  abstract execute(context: BehaviorContext): NodeStatus;
}

export abstract class ConditionNode extends BehaviorNode {
  abstract execute(context: BehaviorContext): NodeStatus;
}

// === CONDITION NODES ===

export class IsPlayerNearbyCondition extends ConditionNode {
  private range: number;
  
  constructor(range: number = 5) {
    super();
    this.range = range;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const nearbyPlayers = context.blackboard.get<any[]>('nearbyPlayers') || [];
    const entityPosition = context.blackboard.get<{x: number, y: number}>('position');
    
    if (!entityPosition) {
      return NodeStatus.FAILURE;
    }
    
    const playerInRange = nearbyPlayers.some(player => {
      const distance = Math.hypot(
        player.position.x - entityPosition.x,
        player.position.y - entityPosition.y
      );
      return distance <= this.range;
    });
    
    return playerInRange ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class HasTargetCondition extends ConditionNode {
  execute(context: BehaviorContext): NodeStatus {
    const target = context.blackboard.get('currentTarget');
    return target ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class IsAtPositionCondition extends ConditionNode {
  private tolerance: number;
  
  constructor(tolerance: number = 0.5) {
    super();
    this.tolerance = tolerance;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    const targetPosition = context.blackboard.get<{x: number, y: number}>('targetPosition');
    
    if (!position || !targetPosition) {
      return NodeStatus.FAILURE;
    }
    
    const distance = Math.hypot(
      position.x - targetPosition.x,
      position.y - targetPosition.y
    );
    
    return distance <= this.tolerance ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

export class HealthBelowCondition extends ConditionNode {
  private threshold: number;
  
  constructor(threshold: number = 0.3) {
    super();
    this.threshold = threshold;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const health = context.blackboard.get<number>('health') || 1.0;
    const maxHealth = context.blackboard.get<number>('maxHealth') || 1.0;
    
    const healthPercent = health / maxHealth;
    return healthPercent <= this.threshold ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

// === ACTION NODES ===

export class IdleAction extends ActionNode {
  private duration: number;
  private elapsed: number = 0;
  
  constructor(duration: number = 2000) { // milliseconds
    super();
    this.duration = duration;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    this.elapsed += context.deltaTime;
    
    if (this.elapsed >= this.duration) {
      this.reset();
      return NodeStatus.SUCCESS;
    }
    
    return NodeStatus.RUNNING;
  }
  
  reset(): void {
    this.elapsed = 0;
  }
}

export class MoveToPositionAction extends ActionNode {
  private speed: number;
  
  constructor(speed: number = 2.0) { // tiles per second
    super();
    this.speed = speed;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    const targetPosition = context.blackboard.get<{x: number, y: number}>('targetPosition');
    
    if (!position || !targetPosition) {
      return NodeStatus.FAILURE;
    }
    
    const dx = targetPosition.x - position.x;
    const dy = targetPosition.y - position.y;
    const distance = Math.hypot(dx, dy);
    
    // Check if we're close enough
    if (distance <= 0.1) {
      return NodeStatus.SUCCESS;
    }
    
    // Move towards target
    const moveDistance = this.speed * (context.deltaTime / 1000);
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    const actualMoveDistance = Math.min(moveDistance, distance);
    
    const newPosition = {
      x: position.x + normalizedDx * actualMoveDistance,
      y: position.y + normalizedDy * actualMoveDistance
    };
    
    // Check if new position is walkable
    if (!this.isPositionWalkable(newPosition, context)) {
      return NodeStatus.FAILURE;
    }
    
    context.blackboard.set('position', newPosition);
    context.blackboard.set('needsPositionUpdate', true);
    
    return NodeStatus.RUNNING;
  }
  
  private isPositionWalkable(position: {x: number, y: number}, context: BehaviorContext): boolean {
    if (!context.poiLayout) {
      // No layout data available, assume walkable
      return true;
    }
    
    const layout = context.poiLayout;
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    
    // Check bounds
    if (y < 0 || y >= layout.length || x < 0 || x >= layout[0].length) {
      return false; // Outside bounds is not walkable
    }
    
    const cell = layout[y][x];
    
    // Check if cell has walkable property
    if (cell && typeof cell.walkable === 'boolean') {
      return cell.walkable;
    }
    
    // Fallback: assume walkable if no walkable property found
    return true;
  }
}

export class SetTargetPlayerAction extends ActionNode {
  execute(context: BehaviorContext): NodeStatus {
    const nearbyPlayers = context.blackboard.get<any[]>('nearbyPlayers') || [];
    const entityPosition = context.blackboard.get<{x: number, y: number}>('position');
    
    if (!entityPosition || nearbyPlayers.length === 0) {
      return NodeStatus.FAILURE;
    }
    
    // Find closest player
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    for (const player of nearbyPlayers) {
      const distance = Math.hypot(
        player.position.x - entityPosition.x,
        player.position.y - entityPosition.y
      );
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }
    
    if (closestPlayer) {
      context.blackboard.set('currentTarget', closestPlayer);
      return NodeStatus.SUCCESS;
    }
    
    return NodeStatus.FAILURE;
  }
}

export class SetRandomTargetPositionAction extends ActionNode {
  private range: number;
  
  constructor(range: number = 3) {
    super();
    this.range = range;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    
    if (!position) {
      return NodeStatus.FAILURE;
    }
    
    // Generate random position within range
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.range;
    
    const targetPosition = {
      x: position.x + Math.cos(angle) * distance,
      y: position.y + Math.sin(angle) * distance
    };
    
    context.blackboard.set('targetPosition', targetPosition);
    return NodeStatus.SUCCESS;
  }
}

export class ClearTargetAction extends ActionNode {
  execute(context: BehaviorContext): NodeStatus {
    context.blackboard.delete('currentTarget');
    context.blackboard.delete('targetPosition');
    return NodeStatus.SUCCESS;
  }
}

export class FaceTargetAction extends ActionNode {
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    const target = context.blackboard.get<any>('currentTarget');
    
    if (!position || !target || !target.position) {
      return NodeStatus.FAILURE;
    }
    
    const dx = target.position.x - position.x;
    const dy = target.position.y - position.y;
    const angle = Math.atan2(dy, dx);
    
    context.blackboard.set('facing', angle);
    return NodeStatus.SUCCESS;
  }
}

// === BAT-SPECIFIC ACTION NODES ===

export class SetWallTargetAction extends ActionNode {
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    const poiId = context.blackboard.get<string>('poiId');
    
    if (!position || !poiId) {
      return NodeStatus.FAILURE;
    }
    
    if (!context.poiLayout || context.poiLayout.length === 0) {
      // Fallback to random position if no layout
      const fallbackPos = {
        x: position.x + (Math.random() - 0.5) * 20,
        y: position.y + (Math.random() - 0.5) * 20
      };
      context.blackboard.set('targetPosition', fallbackPos);
      context.blackboard.set('isFlying', true);
      return NodeStatus.SUCCESS;
    }
    
    const layout = context.poiLayout;
    const height = layout.length;
    const width = layout[0]?.length || 0;
    
    if (width === 0 || height === 0) {
      return NodeStatus.FAILURE;
    }
    
    // Generate potential wall perch positions along the edges
    const wallPositions: { x: number, y: number }[] = [];
    
    // Top and bottom walls
    for (let x = 2; x < width - 2; x += 2) {
      wallPositions.push({ x, y: 2 }); // Top
      wallPositions.push({ x, y: height - 3 }); // Bottom
    }
    
    // Left and right walls  
    for (let y = 2; y < height - 2; y += 2) {
      wallPositions.push({ x: 2, y }); // Left
      wallPositions.push({ x: width - 3, y }); // Right
    }
    
    // Add corners
    wallPositions.push(
      { x: 3, y: 3 },
      { x: width - 4, y: 3 },
      { x: 3, y: height - 4 },
      { x: width - 4, y: height - 4 }
    );
    
    if (wallPositions.length === 0) {
      return NodeStatus.FAILURE;
    }
    
    // Pick a random wall position that's not too close to current position
    let selectedWall = null;
    let attempts = 0;
    const minDistance = 5;
    
    while (!selectedWall && attempts < 20) {
      const candidate = wallPositions[Math.floor(Math.random() * wallPositions.length)];
      const distance = Math.hypot(candidate.x - position.x, candidate.y - position.y);
      
      // Select if it's at least minDistance tiles away
      if (distance >= minDistance) {
        selectedWall = candidate;
      }
      attempts++;
    }
    
    // If no suitable wall found, just pick any wall
    if (!selectedWall) {
      selectedWall = wallPositions[Math.floor(Math.random() * wallPositions.length)];
    }
    
    context.blackboard.set('targetPosition', selectedWall);
    context.blackboard.set('isFlying', true);
    return NodeStatus.SUCCESS;
  }
}

export class PerchAction extends ActionNode {
  private duration: number;
  private elapsed: number = 0;
  
  constructor(duration: number = 3000) { // Perch for 3 seconds by default
    super();
    this.duration = duration;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    // Set perching state on first execution
    if (this.elapsed === 0) {
      context.blackboard.set('isPerching', true);
      context.blackboard.set('isFlying', false);
    }
    
    this.elapsed += context.deltaTime;
    
    if (this.elapsed >= this.duration) {
      this.reset();
      context.blackboard.set('isPerching', false);
      return NodeStatus.SUCCESS;
    }
    
    return NodeStatus.RUNNING;
  }
  
  reset(): void {
    this.elapsed = 0;
  }
}

export class FlyToPositionAction extends ActionNode {
  private speed: number;
  
  constructor(speed: number = 4.0) { // Bats fly faster than walking entities
    super();
    this.speed = speed;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    const position = context.blackboard.get<{x: number, y: number}>('position');
    const targetPosition = context.blackboard.get<{x: number, y: number}>('targetPosition');
    
    if (!position || !targetPosition) {
      return NodeStatus.FAILURE;
    }
    
    const dx = targetPosition.x - position.x;
    const dy = targetPosition.y - position.y;
    const distance = Math.hypot(dx, dy);
    
    // Check if we're close enough to perch
    if (distance <= 0.5) {
      context.blackboard.set('isFlying', false);
      return NodeStatus.SUCCESS;
    }
    
    // Fly towards target with some wavering for natural movement
    const moveDistance = this.speed * (context.deltaTime / 1000);
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    // Add slight wavering to flight path
    const waveAmount = Math.sin(Date.now() / 200) * 0.1;
    const actualMoveDistance = Math.min(moveDistance, distance);
    
    const newPosition = {
      x: position.x + normalizedDx * actualMoveDistance + waveAmount,
      y: position.y + normalizedDy * actualMoveDistance
    };
    
    // Bats can fly over walls, but let's still check bounds
    if (context.poiLayout) {
      const layout = context.poiLayout;
      const x = Math.floor(newPosition.x);
      const y = Math.floor(newPosition.y);
      
      // Check bounds - bats shouldn't fly outside the POI
      if (y < 0 || y >= layout.length || x < 0 || x >= layout[0].length) {
        return NodeStatus.FAILURE; // Outside bounds
      }
    }
    
    context.blackboard.set('position', newPosition);
    context.blackboard.set('needsPositionUpdate', true);
    context.blackboard.set('isFlying', true);
    
    return NodeStatus.RUNNING;
  }
}

// === UTILITY FUNCTIONS ===

export class LogAction extends ActionNode {
  private message: string;
  
  constructor(message: string) {
    super();
    this.message = message;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    console.log(`[Entity ${context.entityId}] ${this.message}`);
    return NodeStatus.SUCCESS;
  }
}