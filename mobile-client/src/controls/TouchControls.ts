import { VirtualJoystick, JoystickData } from './VirtualJoystick';

export interface TouchControlsData {
  movement: JoystickData;
  interact: boolean;
  chat: boolean;
  pinchScale: number;
  panDelta: { x: number, y: number };
}

export class TouchControls {
  private joystick: VirtualJoystick;
  private interactButton: HTMLElement;
  private chatButton: HTMLElement;
  private gameCanvas: HTMLCanvasElement;
  
  private currentData: TouchControlsData;
  private callbacks: {
    onMove?: (data: TouchControlsData) => void;
    onInteract?: () => void;
    onChat?: () => void;
    onPinch?: (scale: number, center: { x: number, y: number }) => void;
    onPan?: (delta: { x: number, y: number }) => void;
  } = {};
  
  // Gesture tracking
  private isGesturing = false;
  private lastTouchDistance = 0;
  private lastTouchCenter = { x: 0, y: 0 };
  private touchStartPositions: { x: number, y: number }[] = [];
  
  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas not found: ${canvasId}`);
    }
    
    this.gameCanvas = canvas;
    
    // Initialize joystick
    this.joystick = new VirtualJoystick('joystick', (data) => {
      this.currentData.movement = data;
      this.notifyMove();
    });
    
    // Get action buttons
    const interactBtn = document.getElementById('interactButton');
    const chatBtn = document.getElementById('chatButton');
    
    if (!interactBtn || !chatBtn) {
      throw new Error('Action buttons not found');
    }
    
    this.interactButton = interactBtn;
    this.chatButton = chatBtn;
    
    // Initialize data
    this.currentData = {
      movement: this.joystick.getCurrentData(),
      interact: false,
      chat: false,
      pinchScale: 1,
      panDelta: { x: 0, y: 0 }
    };
    
    this.setupEventListeners();
    console.log('📱 Touch controls initialized');
  }
  
  private setupEventListeners(): void {
    // Action buttons
    this.setupButton(this.interactButton, () => {
      this.currentData.interact = true;
      this.callbacks.onInteract?.();
      
      // Reset after short delay
      setTimeout(() => {
        this.currentData.interact = false;
      }, 100);
    });
    
    this.setupButton(this.chatButton, () => {
      this.currentData.chat = true;
      this.callbacks.onChat?.();
      
      setTimeout(() => {
        this.currentData.chat = false;
      }, 100);
    });
    
    // Canvas touch gestures
    this.setupCanvasGestures();
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
      if (e.target === this.gameCanvas || 
          e.target === this.interactButton || 
          e.target === this.chatButton) {
        e.preventDefault();
      }
    }, { passive: false });
  }
  
  private setupButton(button: HTMLElement, callback: () => void): void {
    const handlePress = (event: Event) => {
      event.preventDefault();
      button.classList.add('pressed');
      callback();
      
      // Visual feedback
      this.vibrateIfSupported(30);
      
      // Remove pressed state after animation
      setTimeout(() => {
        button.classList.remove('pressed');
      }, 150);
    };
    
    // Touch events
    button.addEventListener('touchstart', handlePress, { passive: false });
    
    // Mouse events for desktop testing
    button.addEventListener('mousedown', handlePress);
    
    // Prevent double-tap zoom
    button.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
  }
  
  private setupCanvasGestures(): void {
    let touchStartTime = 0;
    let lastPanPosition: { x: number, y: number } | null = null;
    
    this.gameCanvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      
      touchStartTime = Date.now();
      this.touchStartPositions = Array.from(event.touches).map(touch => ({
        x: touch.clientX,
        y: touch.clientY
      }));
      
      if (event.touches.length === 1) {
        // Single touch - potential pan start
        lastPanPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
      } else if (event.touches.length === 2) {
        // Two fingers - pinch start
        this.isGesturing = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        this.lastTouchDistance = this.getDistance(touch1, touch2);
        this.lastTouchCenter = this.getCenter(touch1, touch2);
      }
    }, { passive: false });
    
    this.gameCanvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1 && lastPanPosition && !this.isGesturing) {
        // Single finger pan
        const currentPos = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
        
        const delta = {
          x: currentPos.x - lastPanPosition.x,
          y: currentPos.y - lastPanPosition.y
        };
        
        this.currentData.panDelta = delta;
        this.callbacks.onPan?.(delta);
        
        lastPanPosition = currentPos;
        
      } else if (event.touches.length === 2) {
        // Two finger pinch/zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        const currentDistance = this.getDistance(touch1, touch2);
        const currentCenter = this.getCenter(touch1, touch2);
        
        if (this.lastTouchDistance > 0) {
          const scale = currentDistance / this.lastTouchDistance;
          this.currentData.pinchScale = scale;
          this.callbacks.onPinch?.(scale, currentCenter);
        }
        
        this.lastTouchDistance = currentDistance;
        this.lastTouchCenter = currentCenter;
      }
    }, { passive: false });
    
    this.gameCanvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      
      const touchDuration = Date.now() - touchStartTime;
      
      // Reset gesture state
      if (event.touches.length === 0) {
        this.isGesturing = false;
        lastPanPosition = null;
        this.lastTouchDistance = 0;
        this.currentData.panDelta = { x: 0, y: 0 };
        this.currentData.pinchScale = 1;
      }
      
      // Handle tap if it was quick and didn't move much
      if (touchDuration < 300 && event.touches.length === 0 && 
          this.touchStartPositions.length === 1) {
        const startPos = this.touchStartPositions[0];
        const endPos = event.changedTouches[0];
        const distance = Math.sqrt(
          Math.pow(endPos.clientX - startPos.x, 2) + 
          Math.pow(endPos.clientY - startPos.y, 2)
        );
        
        if (distance < 10) {
          // It was a tap - could be used for camera centering or other actions
          console.log('Canvas tap detected');
        }
      }
    }, { passive: false });
  }
  
  private getDistance(touch1: Touch, touch2: Touch): number {
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }
  
  private getCenter(touch1: Touch, touch2: Touch): { x: number, y: number } {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }
  
  private notifyMove(): void {
    this.callbacks.onMove?.(this.currentData);
  }
  
  private vibrateIfSupported(duration: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
  
  // Public API
  onMove(callback: (data: TouchControlsData) => void): void {
    this.callbacks.onMove = callback;
  }
  
  onInteract(callback: () => void): void {
    this.callbacks.onInteract = callback;
  }
  
  onChat(callback: () => void): void {
    this.callbacks.onChat = callback;
  }
  
  onPinch(callback: (scale: number, center: { x: number, y: number }) => void): void {
    this.callbacks.onPinch = callback;
  }
  
  onPan(callback: (delta: { x: number, y: number }) => void): void {
    this.callbacks.onPan = callback;
  }
  
  getCurrentData(): TouchControlsData {
    return { ...this.currentData };
  }
  
  reset(): void {
    this.joystick.reset();
    this.currentData = {
      movement: this.joystick.getCurrentData(),
      interact: false,
      chat: false,
      pinchScale: 1,
      panDelta: { x: 0, y: 0 }
    };
  }
  
  setEnabled(enabled: boolean): void {
    const controls = document.querySelector('.mobile-controls') as HTMLElement;
    if (controls) {
      controls.style.pointerEvents = enabled ? 'auto' : 'none';
      controls.style.opacity = enabled ? '1' : '0.5';
    }
  }
  
  destroy(): void {
    this.joystick.destroy();
    console.log('📱 Touch controls destroyed');
  }
}