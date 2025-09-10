import { io, Socket } from 'socket.io-client';
import { TouchControls, TouchControlsData } from '@/controls/TouchControls';
import { Renderer } from './Renderer';

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color?: string;
}

interface GameWorld {
  seed: string;
  width: number;
  height: number;
  biomes: any[];
  pois: any[];
  rivers: any[];
}

interface GameState {
  players: Map<string, Player>;
  currentPlayer?: Player;
  world?: GameWorld;
  camera: {
    x: number;
    y: number;
    zoom: number;
    targetX: number;
    targetY: number;
    targetZoom: number;
  };
  currentPOI?: any;
  poiInteriors: Map<string, any>;
}

export class GameEngine {
  private socket: Socket | null = null;
  private renderer: Renderer;
  private touchControls: TouchControls;
  private gameState: GameState;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameCount = 0;
  private currentPlayerName = '';
  
  // Movement state
  private movementVector = { x: 0, y: 0 };
  private lastMovementSent = 0;
  private movementThrottle = 50; // 20Hz movement updates
  
  // Performance monitoring
  private fpsHistory: number[] = [];
  private lastFpsUpdate = 0;
  
  constructor(canvasId: string) {
    this.renderer = new Renderer(canvasId);
    this.touchControls = new TouchControls(canvasId);
    
    this.gameState = {
      players: new Map(),
      camera: {
        x: 0,
        y: 0,
        zoom: 3, // Start with 3x zoom for mobile - makes 8px tiles = 24px
        targetX: 0,
        targetY: 0,
        targetZoom: 3
      },
      poiInteriors: new Map()
    };
    
    this.setupTouchControls();
    console.log('🎮 Game engine initialized');
  }
  
  async connect(worldSeed: string, playerName: string): Promise<void> {
    this.currentPlayerName = playerName;
    
    return new Promise((resolve, reject) => {
      try {
        // Connect to the game server - handle both localhost and network access
        let serverHost = window.location.hostname;
        
        // If accessing via localhost/127.0.0.1 but we're on mobile, we need the network IP
        if (serverHost === 'localhost' || serverHost === '127.0.0.1') {
          // For mobile testing, try to detect if we're on mobile and use a fallback
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            console.warn('⚠️ Mobile device detected accessing localhost - this may not work');
            console.log('💡 Try accessing the app via your computer\'s network IP address instead');
          }
        }
        
        const serverUrl = `${window.location.protocol}//${serverHost}:3004`;
        console.log('🔗 Connecting to:', `${serverUrl}/world/${worldSeed}`);
        
        this.socket = io(`${serverUrl}/world/${worldSeed}`, {
          transports: ['polling', 'websocket'],
          timeout: 10000,
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          query: {
            name: playerName
          }
        });
        
        this.socket.on('connect', () => {
          console.log('🌐 Connected to game server');
          this.setupSocketHandlers();
          
          // No need to send join - server creates player automatically
          this.updateConnectionStatus(true);
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('❌ Connection failed:', error);
          console.error('🔍 Server URL was:', serverUrl);
          console.error('🔍 Make sure both ports are tunneled: 3004 (game server) and 3010 (mobile client)');
          this.updateConnectionStatus(false);
          reject(error);
        });
        
        this.socket.on('disconnect', () => {
          console.log('📴 Disconnected from server');
          this.updateConnectionStatus(false);
        });
        
      } catch (error) {
        console.error('❌ Failed to connect:', error);
        reject(error);
      }
    });
  }
  
  private setupSocketHandlers(): void {
    if (!this.socket) return;
    
    // Welcome message with initial player data
    this.socket.on('welcome', async (data: any) => {
      console.log('👋 Welcome data received:', data);
      
      // Set up current player
      this.gameState.currentPlayer = {
        id: data.you.userId,
        name: data.you.name || this.currentPlayerName,
        x: data.you.position.x,
        y: data.you.position.y
      };
      
      this.gameState.players.set(data.you.userId, this.gameState.currentPlayer);
      
      // Initialize camera on player with deadzone system
      this.gameState.camera.x = data.you.position.x;
      this.gameState.camera.y = data.you.position.y;
      this.gameState.camera.targetX = data.you.position.x;
      this.gameState.camera.targetY = data.you.position.y;
      this.gameState.camera.zoom = 3;
      this.gameState.camera.targetZoom = 3;
      
      console.log('✅ Player initialized:', this.gameState.currentPlayer);
      console.log('📍 Camera position:', this.gameState.camera);
      console.log('🎯 Player at pixels:', data.you.position.x, data.you.position.y);
      console.log('🎯 Player at tiles:', Math.floor(data.you.position.x / 8), Math.floor(data.you.position.y / 8));
      
      // Load world data via HTTP API like desktop client does
      try {
        const serverUrl = `${window.location.protocol}//${window.location.hostname}:3004`;
        const response = await fetch(`${serverUrl}/worlds/${data.seed}/manifest`);
        
        if (response.ok) {
          const worldData = await response.json();
          console.log('🗺️ Received world data via HTTP');
          this.gameState.world = worldData;
          this.renderer.setWorld(worldData);
        } else {
          console.error('❌ Failed to load world data:', response.statusText);
        }
      } catch (error) {
        console.error('❌ Error loading world data:', error);
      }
    });
    
    // World manifest data
    this.socket.on('world-manifest', (world: GameWorld) => {
      console.log('🗺️ Received world manifest');
      this.gameState.world = world;
      this.renderer.setWorld(world);
    });
    
    // Player movement updates
    this.socket.on('player-positions', (players: any[]) => {
      // Update all players' positions including current player
      for (const playerData of players) {
        const player = this.gameState.players.get(playerData.userId) || {
          id: playerData.userId,
          name: playerData.name,
          x: playerData.position.x,
          y: playerData.position.y
        };
        
        player.x = playerData.position.x;
        player.y = playerData.position.y;
        this.gameState.players.set(playerData.userId, player);
        
        // If this is the current player, update position (camera follows automatically)
        if (playerData.userId === this.gameState.currentPlayer?.id) {
          // Server authoritative position - override client prediction
          this.gameState.currentPlayer.x = playerData.position.x;
          this.gameState.currentPlayer.y = playerData.position.y;
          // Camera targeting is handled in update() method
          
          console.log(`📍 Player position updated from server: (${playerData.position.x}, ${playerData.position.y})`);
        }
      }
    });
    
    // Chat messages
    this.socket.on('chat-message', (data: { from: any; message: string; channel?: string }) => {
      this.displayChatMessage({
        player: data.from.name || data.from.userId,
        message: data.message,
        channel: data.channel
      });
    });
    
    // POI interactions
    this.socket.on('poi-interior', (data: any) => {
      console.log('🏠 Entered POI interior', data);
      console.log('Interior data structure:', data.interior);
      this.gameState.currentPOI = data;
      this.renderer.setPOIInterior(data.interior);
      
      // Position player at the interior entrance point
      if (data.interior && data.interior.entrance && this.gameState.currentPlayer) {
        console.log('📍 Positioning player at entrance:', data.interior.entrance);
        this.gameState.currentPlayer.x = data.interior.entrance.x;
        this.gameState.currentPlayer.y = data.interior.entrance.y;
        
        // Update camera to center on entrance
        const pixelX = data.interior.entrance.x * 8; // Convert to pixels
        const pixelY = data.interior.entrance.y * 8;
        this.gameState.camera.x = pixelX;
        this.gameState.camera.y = pixelY;
        this.gameState.camera.targetX = pixelX;
        this.gameState.camera.targetY = pixelY;
      }
    });
    
    // POI interaction error handling
    this.socket.on('poi-entry-error', (data: any) => {
      console.log('❌ POI entry error:', data.error);
      let errorMessage = 'Cannot enter POI';
      switch (data.error) {
        case 'too_far':
          errorMessage = 'Too far from POI';
          break;
        case 'poi_not_found':
          errorMessage = 'POI not found';
          break;
        case 'door_required':
          errorMessage = 'Must use the door';
          break;
        default:
          errorMessage = 'Cannot enter POI';
      }
      this.showInteractionFeedback(errorMessage);
    });
    
    // Chunk state updates
    this.socket.on('chunk-state', (state: any) => {
      console.log('📍 Chunk state:', state.chunkId);
    });
  }
  
  private setupTouchControls(): void {
    this.touchControls.onMove((data: TouchControlsData) => {
      // Update movement vector
      this.movementVector.x = data.movement.x;
      this.movementVector.y = data.movement.y;
      
      // Throttled network updates
      const now = Date.now();
      if (now - this.lastMovementSent > this.movementThrottle && 
          (data.movement.x !== 0 || data.movement.y !== 0)) {
        this.sendMovement();
        this.lastMovementSent = now;
      }
    });
    
    this.touchControls.onInteract(() => {
      this.handlePOIInteraction();
    });
    
    this.touchControls.onChat(() => {
      this.toggleChat();
    });
    
    this.touchControls.onPinch((scale: number, center: { x: number, y: number }) => {
      const currentZoom = this.gameState.camera.zoom;
      const newZoom = Math.max(0.3, Math.min(3.0, currentZoom * scale));
      this.gameState.camera.targetZoom = newZoom;
    });
    
    this.touchControls.onPan((delta: { x: number, y: number }) => {
      // Disable camera panning on mobile to maintain player focus
      // Pan gestures should only be used for menu interactions, not camera movement
      console.log('📱 Pan gesture ignored to maintain camera focus on player');
    });
  }
  
  private sendMovement(): void {
    if (!this.socket || !this.gameState.currentPlayer) return;
    
    let newX, newY;
    
    if (this.gameState.currentPOI) {
      // POI interior: movement in tile coordinates
      const tileSpeed = 2; // tiles per second
      const deltaTime = this.movementThrottle / 1000;
      
      newX = this.gameState.currentPlayer.x + (this.movementVector.x * tileSpeed * deltaTime);
      newY = this.gameState.currentPlayer.y + (this.movementVector.y * tileSpeed * deltaTime);
      
      // Round to nearest tile for POI interiors
      newX = Math.round(newX);
      newY = Math.round(newY);
    } else {
      // Main world: movement in pixel coordinates
      const speed = 100; // pixels per second
      const deltaTime = this.movementThrottle / 1000;
      
      newX = this.gameState.currentPlayer.x + (this.movementVector.x * speed * deltaTime);
      newY = this.gameState.currentPlayer.y + (this.movementVector.y * speed * deltaTime);
    }
    
    // Validate that the new position is walkable
    if (!this.isPositionWalkable(newX, newY)) {
      return; // Don't move to unwalkable terrain
    }
    
    this.socket.emit('move-player', { x: newX, y: newY });
    
    // Optimistic update - only update player position
    // Camera targeting is handled in update() method
    this.gameState.currentPlayer.x = newX;
    this.gameState.currentPlayer.y = newY;
    
    // Update player in map
    this.gameState.players.set(this.gameState.currentPlayer.id, this.gameState.currentPlayer);
  }
  
  private isPositionWalkable(x: number, y: number): boolean {
    // POI interior walkability check
    if (this.gameState.currentPOI && this.gameState.currentPOI.interior) {
      const interior = this.gameState.currentPOI.interior;
      const tileX = Math.floor(x);
      const tileY = Math.floor(y);
      
      // Check bounds
      if (tileX < 0 || tileX >= interior.width || tileY < 0 || tileY >= interior.height) {
        return false;
      }
      
      // Check if tile exists and is walkable
      if (interior.layout && interior.layout[tileY] && interior.layout[tileY][tileX]) {
        const tile = interior.layout[tileY][tileX];
        return tile.walkable !== false; // Default to walkable if not specified
      }
      
      return false;
    }
    
    // Main world walkability check
    if (!this.renderer || !this.renderer.world) return false;
    
    // Convert pixel coordinates to tile coordinates
    const tileX = Math.floor(x / 8); // 8 pixels per tile
    const tileY = Math.floor(y / 8);
    
    // Get biome at this position using renderer's method
    const biome = this.renderer.getBiomeAt(x, y);
    if (!biome) return false; // If no biome data, assume not walkable
    
    // Get walkable status from renderer's biome data
    const biomeData = this.renderer.biomeData[biome.type];
    if (!biomeData || typeof biomeData === 'string') {
      return false; // Legacy colors or unknown biomes are not walkable
    }
    
    return biomeData.walkable;
  }
  
  private handlePOIInteraction(): void {
    if (!this.gameState.currentPlayer || !this.renderer.world?.world?.pois) return;
    
    const nearbyPOI = this.findNearbyPOI();
    if (nearbyPOI) {
      console.log(`🏠 Attempting to enter POI: ${nearbyPOI.type} at distance ${nearbyPOI.distance}`);
      this.socket?.emit('enter-poi', { poiId: nearbyPOI.poi.id });
      this.showInteractionFeedback();
    } else {
      console.log('⚠️ No nearby POI found for interaction');
      this.showInteractionFeedback('No POI nearby');
    }
  }
  
  private findNearbyPOI(): { poi: any, distance: number, type: string } | null {
    if (!this.gameState.currentPlayer || !this.renderer.world?.world?.pois) return null;
    
    const playerX = this.gameState.currentPlayer.x;
    const playerY = this.gameState.currentPlayer.y;
    const INTERACTION_DISTANCE = 24; // 3 tiles × 8 pixels (same as server)
    
    let nearestPOI: { poi: any, distance: number, type: string } | null = null;
    
    for (const poi of this.renderer.world.world.pois) {
      // Convert POI tile coordinates to pixel coordinates
      const poiPixelX = poi.position.x * 8; // 8 pixels per tile
      const poiPixelY = poi.position.y * 8;
      
      const distance = Math.hypot(playerX - poiPixelX, playerY - poiPixelY);
      
      if (distance <= INTERACTION_DISTANCE) {
        // Special case for lighthouse - check door position
        if (poi.type === 'lighthouse') {
          const doorX = poiPixelX;
          const doorY = poiPixelY + 8; // Door is south of POI center
          const dx = Math.abs(playerX - doorX);
          const dy = playerY - poiPixelY; // Must be south of center
          const doorDistance = Math.hypot(playerX - doorX, playerY - doorY);
          
          const atDoor = dx <= 12 && dy >= 0 && doorDistance <= 16;
          if (atDoor) {
            nearestPOI = { poi, distance, type: poi.type };
          }
        } else {
          // Standard POI interaction
          if (!nearestPOI || distance < nearestPOI.distance) {
            nearestPOI = { poi, distance, type: poi.type };
          }
        }
      }
    }
    
    return nearestPOI;
  }
  
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop(this.lastFrameTime);
    
    console.log('▶️ Game loop started');
  }
  
  stop(): void {
    this.isRunning = false;
    console.log('⏹️ Game loop stopped');
  }
  
  private gameLoop(currentTime: number): void {
    if (!this.isRunning) return;
    
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Update game state
    this.update(deltaTime);
    
    // Render frame
    this.render();
    
    // Performance tracking
    this.trackPerformance(deltaTime);
    
    // Schedule next frame
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  
  private update(deltaTime: number): void {
    const camera = this.gameState.camera;
    
    // For mobile, use simpler direct camera following for better responsiveness
    if (this.gameState.currentPlayer) {
      // Always center camera on player for mobile (no deadzone for now)
      camera.targetX = this.gameState.currentPlayer.x;
      camera.targetY = this.gameState.currentPlayer.y;
      
      // Faster camera following for mobile
      const CAMERA_SMOOTHING = 0.15;
      camera.x += (camera.targetX - camera.x) * CAMERA_SMOOTHING;
      camera.y += (camera.targetY - camera.y) * CAMERA_SMOOTHING;
      
    }
    
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;
  }
  
  private render(): void {
    this.renderer.render(this.gameState);
  }
  
  private trackPerformance(deltaTime: number): void {
    this.frameCount++;
    const fps = 1000 / deltaTime;
    this.fpsHistory.push(fps);
    
    // Keep only last 60 frames
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }
    
    // Update FPS display every second
    const now = Date.now();
    if (now - this.lastFpsUpdate > 1000) {
      const avgFps = this.fpsHistory.reduce((a, b) => a + b) / this.fpsHistory.length;
      this.updateFPSDisplay(Math.round(avgFps));
      this.lastFpsUpdate = now;
    }
  }
  
  private updateConnectionStatus(connected: boolean): void {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (statusDot) {
      statusDot.classList.toggle('connected', connected);
    }
    
    if (statusText) {
      statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }
  
  private updatePlayerCount(): void {
    const playerCount = document.getElementById('playerCount');
    if (playerCount) {
      const count = this.gameState.players.size;
      playerCount.textContent = `${count} player${count !== 1 ? 's' : ''}`;
    }
  }
  
  private updateFPSDisplay(fps: number): void {
    // Could add FPS counter to debug UI if needed
    console.log(`📊 FPS: ${fps}`);
  }
  
  private displayChatMessage(data: { player: string; message: string; channel?: string }): void {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      const timestamp = new Date().toLocaleTimeString();
      const messageEl = document.createElement('div');
      messageEl.textContent = `[${timestamp}] ${data.player}: ${data.message}`;
      chatMessages.appendChild(messageEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  
  private toggleChat(): void {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      chatPanel.classList.toggle('open');
      
      if (chatPanel.classList.contains('open')) {
        const chatInput = document.getElementById('chatInput') as HTMLInputElement;
        if (chatInput) {
          setTimeout(() => chatInput.focus(), 100);
        }
      }
    }
  }
  
  private showInteractionFeedback(message?: string): void {
    const prompt = document.getElementById('interactionPrompt');
    if (prompt) {
      if (message) {
        prompt.textContent = message;
      }
      prompt.classList.add('show');
      setTimeout(() => {
        prompt.classList.remove('show');
        if (message) {
          prompt.textContent = ''; // Reset message
        }
      }, 1500);
    }
  }
  
  sendChatMessage(message: string): void {
    if (!this.socket || !message.trim()) return;
    
    this.socket.emit('chat-message', {
      message: message.trim(),
      channel: 'local'
    });
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.stop();
    this.updateConnectionStatus(false);
  }
  
  destroy(): void {
    this.disconnect();
    this.touchControls.destroy();
    this.renderer.destroy();
    console.log('🎮 Game engine destroyed');
  }
}