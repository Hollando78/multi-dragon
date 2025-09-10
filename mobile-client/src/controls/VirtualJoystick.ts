export interface JoystickData {
  x: number; // -1 to 1
  y: number; // -1 to 1
  distance: number; // 0 to 1
  angle: number; // 0 to 2π
  isActive: boolean;
}

export class VirtualJoystick {
  private container: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private isActive = false;
  private startPos = { x: 0, y: 0 };
  private currentPos = { x: 0, y: 0 };
  private maxDistance: number;
  private onMoveCallback?: (data: JoystickData) => void;
  
  constructor(containerId: string, onMove?: (data: JoystickData) => void) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Joystick container not found: ${containerId}`);
    }
    
    this.container = container;
    this.base = container.querySelector('.joystick-base') as HTMLElement;
    this.knob = container.querySelector('.joystick-knob') as HTMLElement;
    this.onMoveCallback = onMove;
    
    if (!this.base || !this.knob) {
      throw new Error('Joystick base or knob elements not found');
    }
    
    // Calculate max distance (half of base diameter minus knob radius)
    this.maxDistance = (this.base.offsetWidth / 2) - (this.knob.offsetWidth / 2);
    
    this.setupEventListeners();
    
    console.log('🎮 Virtual joystick initialized');
  }
  
  private setupEventListeners(): void {
    // Touch events
    this.container.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleEnd.bind(this), { passive: false });
    this.container.addEventListener('touchcancel', this.handleEnd.bind(this), { passive: false });
    
    // Mouse events (for testing on desktop)
    this.container.addEventListener('mousedown', this.handleStart.bind(this));
    document.addEventListener('mousemove', this.handleMove.bind(this));
    document.addEventListener('mouseup', this.handleEnd.bind(this));
    
    // Prevent context menu
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  
  private handleStart(event: TouchEvent | MouseEvent): void {
    event.preventDefault();
    
    const point = this.getEventPoint(event);
    if (!point) return;
    
    this.isActive = true;
    this.startPos = this.getRelativePosition(point);
    this.currentPos = { ...this.startPos };
    
    this.knob.style.transition = 'none';
    this.container.classList.add('active');
    
    this.updateJoystick();
  }
  
  private handleMove(event: TouchEvent | MouseEvent): void {
    if (!this.isActive) return;
    
    event.preventDefault();
    
    const point = this.getEventPoint(event);
    if (!point) return;
    
    this.currentPos = this.getRelativePosition(point);
    this.updateJoystick();
  }
  
  private handleEnd(event: TouchEvent | MouseEvent): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.currentPos = { x: 0, y: 0 };
    
    this.knob.style.transition = 'all 0.2s ease';
    this.container.classList.remove('active');
    
    this.updateJoystick();
    
    // Reset knob to center after animation
    setTimeout(() => {
      this.knob.style.transform = 'translate(-50%, -50%)';
    }, 200);
  }
  
  private getEventPoint(event: TouchEvent | MouseEvent): { x: number, y: number } | null {
    if (event instanceof TouchEvent) {
      return event.touches.length > 0 ? 
        { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    } else {
      return { x: event.clientX, y: event.clientY };
    }
  }
  
  private getRelativePosition(point: { x: number, y: number }): { x: number, y: number } {
    const rect = this.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    return {
      x: point.x - centerX,
      y: point.y - centerY
    };
  }
  
  private updateJoystick(): void {
    const distance = Math.sqrt(this.currentPos.x ** 2 + this.currentPos.y ** 2);
    const angle = Math.atan2(this.currentPos.y, this.currentPos.x);
    
    // Constrain to max distance
    let constrainedX = this.currentPos.x;
    let constrainedY = this.currentPos.y;
    
    if (distance > this.maxDistance) {
      constrainedX = Math.cos(angle) * this.maxDistance;
      constrainedY = Math.sin(angle) * this.maxDistance;
    }
    
    // Update knob visual position
    this.knob.style.transform = `translate(${constrainedX - this.knob.offsetWidth/2}px, ${constrainedY - this.knob.offsetHeight/2}px)`;
    
    // Calculate normalized values
    const normalizedDistance = Math.min(distance / this.maxDistance, 1);
    const normalizedX = constrainedX / this.maxDistance;
    const normalizedY = constrainedY / this.maxDistance;
    
    // Create joystick data
    const joystickData: JoystickData = {
      x: normalizedX,
      y: normalizedY,
      distance: normalizedDistance,
      angle: angle,
      isActive: this.isActive
    };
    
    // Call callback
    if (this.onMoveCallback) {
      this.onMoveCallback(joystickData);
    }
    
    // Emit custom event
    this.container.dispatchEvent(new CustomEvent('joystickmove', {
      detail: joystickData
    }));
  }
  
  // Public methods
  reset(): void {
    this.isActive = false;
    this.currentPos = { x: 0, y: 0 };
    this.knob.style.transition = 'all 0.2s ease';
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.container.classList.remove('active');
  }
  
  setPosition(x: number, y: number): void {
    this.currentPos = {
      x: x * this.maxDistance,
      y: y * this.maxDistance
    };
    this.updateJoystick();
  }
  
  getCurrentData(): JoystickData {
    const distance = Math.sqrt(this.currentPos.x ** 2 + this.currentPos.y ** 2);
    const angle = Math.atan2(this.currentPos.y, this.currentPos.x);
    const normalizedDistance = Math.min(distance / this.maxDistance, 1);
    
    return {
      x: this.currentPos.x / this.maxDistance,
      y: this.currentPos.y / this.maxDistance,
      distance: normalizedDistance,
      angle: angle,
      isActive: this.isActive
    };
  }
  
  destroy(): void {
    this.container.removeEventListener('touchstart', this.handleStart);
    this.container.removeEventListener('touchmove', this.handleMove);
    this.container.removeEventListener('touchend', this.handleEnd);
    this.container.removeEventListener('touchcancel', this.handleEnd);
    this.container.removeEventListener('mousedown', this.handleStart);
    document.removeEventListener('mousemove', this.handleMove);
    document.removeEventListener('mouseup', this.handleEnd);
    
    console.log('🎮 Virtual joystick destroyed');
  }
}