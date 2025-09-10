/**
 * Behavior Tree System - Core Framework
 * Based on industry best practices for extensible entity AI
 */

export enum NodeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE', 
  RUNNING = 'RUNNING'
}

export interface BehaviorContext {
  entityId: string;
  blackboard: Blackboard;
  deltaTime: number;
  worldState: any;
  poiLayout?: any[][]; // 2D array of cells with walkable property
}

export abstract class BehaviorNode {
  protected children: BehaviorNode[] = [];
  
  abstract execute(context: BehaviorContext): NodeStatus;
  
  addChild(child: BehaviorNode): void {
    this.children.push(child);
  }
  
  reset(): void {
    // Override in subclasses that need state reset
  }
}

// Composite Nodes
export class SequenceNode extends BehaviorNode {
  private currentChildIndex = 0;
  
  execute(context: BehaviorContext): NodeStatus {
    while (this.currentChildIndex < this.children.length) {
      const status = this.children[this.currentChildIndex].execute(context);
      
      if (status === NodeStatus.FAILURE) {
        this.reset();
        return NodeStatus.FAILURE;
      }
      
      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
      
      this.currentChildIndex++;
    }
    
    this.reset();
    return NodeStatus.SUCCESS;
  }
  
  reset(): void {
    this.currentChildIndex = 0;
    this.children.forEach(child => child.reset());
  }
}

export class SelectorNode extends BehaviorNode {
  private currentChildIndex = 0;
  
  execute(context: BehaviorContext): NodeStatus {
    while (this.currentChildIndex < this.children.length) {
      const status = this.children[this.currentChildIndex].execute(context);
      
      if (status === NodeStatus.SUCCESS) {
        this.reset();
        return NodeStatus.SUCCESS;
      }
      
      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
      
      this.currentChildIndex++;
    }
    
    this.reset();
    return NodeStatus.FAILURE;
  }
  
  reset(): void {
    this.currentChildIndex = 0;
    this.children.forEach(child => child.reset());
  }
}

export class ParallelNode extends BehaviorNode {
  private requiredSuccesses: number;
  
  constructor(requiredSuccesses: number = 1) {
    super();
    this.requiredSuccesses = requiredSuccesses;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    let successCount = 0;
    let runningCount = 0;
    
    for (const child of this.children) {
      const status = child.execute(context);
      
      if (status === NodeStatus.SUCCESS) {
        successCount++;
      } else if (status === NodeStatus.RUNNING) {
        runningCount++;
      }
    }
    
    if (successCount >= this.requiredSuccesses) {
      return NodeStatus.SUCCESS;
    }
    
    if (runningCount > 0) {
      return NodeStatus.RUNNING;
    }
    
    return NodeStatus.FAILURE;
  }
}

// Decorator Nodes
export class InverterNode extends BehaviorNode {
  execute(context: BehaviorContext): NodeStatus {
    if (this.children.length !== 1) {
      throw new Error('InverterNode must have exactly one child');
    }
    
    const status = this.children[0].execute(context);
    
    if (status === NodeStatus.SUCCESS) {
      return NodeStatus.FAILURE;
    }
    
    if (status === NodeStatus.FAILURE) {
      return NodeStatus.SUCCESS;
    }
    
    return NodeStatus.RUNNING;
  }
}

export class RepeatNode extends BehaviorNode {
  private maxRepeats: number;
  private currentRepeats = 0;
  
  constructor(maxRepeats: number = -1) { // -1 = infinite
    super();
    this.maxRepeats = maxRepeats;
  }
  
  execute(context: BehaviorContext): NodeStatus {
    if (this.children.length !== 1) {
      throw new Error('RepeatNode must have exactly one child');
    }
    
    const status = this.children[0].execute(context);
    
    if (status === NodeStatus.RUNNING) {
      return NodeStatus.RUNNING;
    }
    
    this.currentRepeats++;
    
    if (this.maxRepeats > 0 && this.currentRepeats >= this.maxRepeats) {
      this.reset();
      return status;
    }
    
    this.children[0].reset();
    return NodeStatus.RUNNING;
  }
  
  reset(): void {
    this.currentRepeats = 0;
    super.reset();
  }
}

// Main Behavior Tree Class
export class BehaviorTree {
  private root: BehaviorNode;
  private isRunning = false;
  
  constructor(root: BehaviorNode) {
    this.root = root;
  }
  
  tick(context: BehaviorContext): NodeStatus {
    if (!this.isRunning) {
      this.isRunning = true;
    }
    
    const status = this.root.execute(context);
    
    if (status !== NodeStatus.RUNNING) {
      this.isRunning = false;
      this.root.reset();
    }
    
    return status;
  }
  
  reset(): void {
    this.isRunning = false;
    this.root.reset();
  }
  
  getRoot(): BehaviorNode {
    return this.root;
  }
}

// Blackboard for entity memory and state
export class Blackboard {
  private data: Map<string, any> = new Map();
  
  set<T>(key: string, value: T): void {
    this.data.set(key, value);
  }
  
  get<T>(key: string): T | undefined {
    return this.data.get(key);
  }
  
  has(key: string): boolean {
    return this.data.has(key);
  }
  
  delete(key: string): boolean {
    return this.data.delete(key);
  }
  
  clear(): void {
    this.data.clear();
  }
  
  // For persistence/serialization
  serialize(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.data.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  
  deserialize(data: Record<string, any>): void {
    this.clear();
    Object.entries(data).forEach(([key, value]) => {
      this.data.set(key, value);
    });
  }
}