interface RenderState {
  players: Map<string, any>;
  currentPlayer?: any;
  world?: any;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  currentPOI?: any;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  
  private world: any = null;
  private poiInterior: any = null;
  
  // Rendering config (match desktop client)
  private baseTileSize = 8; // Base tile size in pixels (matches desktop)
  private chunkSize = 64;
  
  // Colors for biomes (adapted from desktop client)
  private biomeColors: { [key: string]: string } = {
    'plains': '#90EE90',
    'forest': '#228B22', 
    'desert': '#F4A460',
    'mountains': '#8B7355',
    'ocean': '#4169E1',
    'swamp': '#556B2F',
    'tundra': '#E0E0E0',
    'volcano': '#8B0000',
    'jungle': '#006400',
    'coast': '#87CEEB',
    'beach': '#F5DEB3',
    'river': '#4682B4',
    'lake': '#1E90FF'
  };
  
  private poiColors: { [key: string]: string } = {
    'village': '#8B4513',
    'cave': '#2F2F2F',
    'tower': '#4B0082',
    'ruins': '#A0522D',
    'shrine': '#FFD700'
  };
  
  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const minimap = document.getElementById('minimap') as HTMLCanvasElement;
    
    if (!canvas || !minimap) {
      throw new Error('Canvas or minimap element not found');
    }
    
    this.canvas = canvas;
    this.minimapCanvas = minimap;
    
    const ctx = canvas.getContext('2d');
    const minimapCtx = minimap.getContext('2d');
    
    if (!ctx || !minimapCtx) {
      throw new Error('Could not get canvas context');
    }
    
    this.ctx = ctx;
    this.minimapCtx = minimapCtx;
    
    this.setupCanvas();
    console.log('🎨 Renderer initialized');
  }
  
  private setupCanvas(): void {
    // Set up canvas size to match container
    this.resizeCanvas();
    
    // Listen for resize events
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resizeCanvas(), 100);
    });
    
    // Set up canvas rendering properties
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // Minimap setup - set canvas resolution to match CSS dimensions
    const minimapComputedStyle = window.getComputedStyle(this.minimapCanvas);
    const minimapDisplayWidth = parseInt(minimapComputedStyle.width);
    const minimapDisplayHeight = parseInt(minimapComputedStyle.height);
    
    // Set canvas resolution to match display size
    this.minimapCanvas.width = minimapDisplayWidth;
    this.minimapCanvas.height = minimapDisplayHeight;
    
    this.minimapCtx.imageSmoothingEnabled = false;
    
  }
  
  private resizeCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Set actual canvas size
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    
    // Scale context for high DPI
    this.ctx.scale(devicePixelRatio, devicePixelRatio);
    
    // Set CSS size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    console.log(`📏 Canvas resized: ${rect.width}x${rect.height} (DPR: ${devicePixelRatio})`);
  }
  
  setWorld(world: any): void {
    this.world = world;
    console.log('🗺️ World data set in renderer');
  }
  
  setPOIInterior(interior: any): void {
    this.poiInterior = interior;
    console.log('🏠 POI interior set:', interior ? 'interior' : 'overworld');
  }
  
  render(gameState: RenderState): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.world) {
      this.renderLoadingScreen();
      return;
    }
    
    // Save context for transformations
    this.ctx.save();
    
    // Apply camera transformations
    this.applyCameraTransform(gameState.camera);
    
    if (this.poiInterior) {
      this.renderPOIInterior(gameState);
    } else {
      this.renderOverworld(gameState);
    }
    
    // Restore context
    this.ctx.restore();
    
    // Render UI elements (not affected by camera)
    this.renderUI(gameState);
    
    // Update minimap
    this.renderMinimap(gameState);
  }
  
  private applyCameraTransform(camera: { x: number, y: number, zoom: number }): void {
    // Get the CSS dimensions (not scaled canvas dimensions)
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    
    // Translate to center, then apply zoom and camera position
    // Use CSS dimensions since context is already scaled by devicePixelRatio
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-camera.x, -camera.y);
  }
  
  private renderLoadingScreen(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, width, height);
    
    this.ctx.fillStyle = '#0080ff';
    this.ctx.font = '24px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Loading world...', width / 2, height / 2);
  }
  
  private renderOverworld(gameState: RenderState): void {
    const camera = gameState.camera;
    const viewWidth = this.canvas.width / camera.zoom;
    const viewHeight = this.canvas.height / camera.zoom;
    
    // Calculate visible tile area (like desktop client)
    const startTileX = Math.max(0, Math.floor((camera.x - viewWidth) / this.baseTileSize));
    const endTileX = Math.ceil((camera.x + viewWidth) / this.baseTileSize);
    const startTileY = Math.max(0, Math.floor((camera.y - viewHeight) / this.baseTileSize));
    const endTileY = Math.ceil((camera.y + viewHeight) / this.baseTileSize);
    
    // Render terrain
    this.renderTerrain(startTileX, endTileX, startTileY, endTileY, camera);
    
    // Render rivers
    this.renderRivers();
    
    // Render POIs
    this.renderPOIs();
    
    // Render players
    this.renderPlayers(gameState.players, gameState.currentPlayer, gameState.camera);
  }
  
  private renderPOIInterior(gameState: RenderState): void {
    if (!this.poiInterior) return;
    
    // Render interior tiles
    const interior = this.poiInterior;
    const tileSize = 32;
    
    for (let y = 0; y < interior.height; y++) {
      for (let x = 0; x < interior.width; x++) {
        const tile = interior.tiles[y * interior.width + x];
        const tileX = x * tileSize;
        const tileY = y * tileSize;
        
        // Render tile based on type
        this.ctx.fillStyle = this.getTileColor(tile);
        this.ctx.fillRect(tileX, tileY, tileSize, tileSize);
        
        // Add tile border
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(tileX, tileY, tileSize, tileSize);
      }
    }
    
    // Render players in interior
    this.renderPlayers(gameState.players, gameState.currentPlayer, gameState.camera);
  }
  
  private renderTerrain(startTileX: number, endTileX: number, startTileY: number, endTileY: number, camera: any): void {
    const tileSize = this.baseTileSize * camera.zoom; // Apply zoom to tile size
    
    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const pixelX = tileX * this.baseTileSize;
        const pixelY = tileY * this.baseTileSize;
        
        const biome = this.getBiomeAt(pixelX, pixelY);
        if (!biome) continue;
        
        // Base biome color
        let color = this.biomeColors[biome.type] || '#90EE90';
        
        // Add color variance
        const variance = this.getColorVariance(tileX, tileY);
        color = this.adjustColor(color, variance);
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(pixelX, pixelY, this.baseTileSize, this.baseTileSize);
      }
    }
  }
  
  private renderRivers(): void {
    if (!this.world.world || !this.world.world.rivers) return;
    
    this.ctx.strokeStyle = this.biomeColors.river;
    this.ctx.lineWidth = 8;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    for (const river of this.world.world.rivers) {
      if (river.points && river.points.length > 1) {
        this.ctx.beginPath();
        
        // Convert tile coordinates to pixel coordinates
        const startPoint = river.points[0];
        this.ctx.moveTo(startPoint.x * this.baseTileSize, startPoint.y * this.baseTileSize);
        
        for (let i = 1; i < river.points.length; i++) {
          const point = river.points[i];
          this.ctx.lineTo(point.x * this.baseTileSize, point.y * this.baseTileSize);
        }
        
        this.ctx.stroke();
      }
    }
  }
  
  private renderPOIs(): void {
    if (!this.world.world || !this.world.world.pois) return;
    
    for (const poi of this.world.world.pois) {
      const color = this.poiColors[poi.type] || '#8B4513';
      const size = 24;
      
      // Convert tile position to pixel position
      const pixelX = poi.position.x * this.baseTileSize;
      const pixelY = poi.position.y * this.baseTileSize;
      
      this.ctx.fillStyle = color;
      this.ctx.fillRect(pixelX - size/2, pixelY - size/2, size, size);
      
      // Add border
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pixelX - size/2, pixelY - size/2, size, size);
      
      // Add POI type indicator
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '12px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(poi.type[0].toUpperCase(), pixelX, pixelY + 4);
    }
  }
  
  private renderPlayers(players: Map<string, any>, currentPlayer?: any, camera?: any): void {
    if (players.size === 0) {
      console.log('⚠️ No players to render');
      return;
    }
    
    players.forEach((player) => {
      const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
      
      
      // Player body
      this.ctx.fillStyle = player.color || (isCurrentPlayer ? '#0080ff' : '#ff4444');
      this.ctx.beginPath();
      this.ctx.arc(player.x, player.y, isCurrentPlayer ? 16 : 12, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Player border
      this.ctx.strokeStyle = isCurrentPlayer ? '#ffffff' : '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Player name
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '12px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(player.name || 'Player', player.x, player.y - 25);
    });
  }
  
  private renderUI(gameState: RenderState): void {
    // Could add debug info, FPS counter, etc.
  }
  
  private renderMinimap(gameState: RenderState): void {
    // Get actual minimap canvas dimensions
    const minimapWidth = this.minimapCanvas.width;
    const minimapHeight = this.minimapCanvas.height;
    
    this.minimapCtx.clearRect(0, 0, minimapWidth, minimapHeight);
    
    if (!this.world || !gameState.currentPlayer) return;
    
    // Use desktop client's coordinate system - minimap shows world in tile coordinates
    const worldSize = this.world.world?.size || 256; // World size in tiles
    
    // Scale to fill the entire minimap canvas
    const scale = Math.min(minimapWidth / worldSize, minimapHeight / worldSize);
    
    // Center the world in the minimap if aspect ratios don't match
    const offsetX = (minimapWidth - worldSize * scale) / 2;
    const offsetY = (minimapHeight - worldSize * scale) / 2;
    
    
    this.minimapCtx.save();
    
    // Render terrain using world tile coordinates (like desktop)
    const sampleRate = 2; // Sample every 2nd tile for performance
    for (let tileY = 0; tileY < worldSize; tileY += sampleRate) {
      for (let tileX = 0; tileX < worldSize; tileX += sampleRate) {
        // Convert tile coordinates to pixel coordinates for biome lookup
        const pixelX = tileX * 8; // 8 pixels per tile
        const pixelY = tileY * 8;
        
        const biome = this.getBiomeAt(pixelX, pixelY);
        if (!biome) continue;
        
        // Render tile at minimap position
        const minimapX = offsetX + tileX * scale;
        const minimapY = offsetY + tileY * scale;
        
        this.minimapCtx.fillStyle = this.biomeColors[biome.type] || '#90EE90';
        this.minimapCtx.fillRect(minimapX, minimapY, scale * sampleRate, scale * sampleRate);
      }
    }
    
    // Render POIs using tile coordinates (like desktop)
    if (this.world.world && this.world.world.pois) {
      this.minimapCtx.fillStyle = '#fff';
      for (const poi of this.world.world.pois) {
        // POIs are already in tile coordinates
        const minimapX = offsetX + poi.position.x * scale;
        const minimapY = offsetY + poi.position.y * scale;
        this.minimapCtx.fillRect(minimapX - 1.5, minimapY - 1.5, 3, 3);
      }
    }
    
    // Render players using pixel-to-tile conversion (like desktop)
    gameState.players.forEach((player) => {
      const isCurrentPlayer = gameState.currentPlayer && player.id === gameState.currentPlayer.id;
      // Convert player pixel coordinates to tile coordinates
      const playerTileX = player.x / 8; // Convert pixels to tiles
      const playerTileY = player.y / 8;
      
      const minimapX = offsetX + playerTileX * scale;
      const minimapY = offsetY + playerTileY * scale;
      
      this.minimapCtx.fillStyle = isCurrentPlayer ? '#0080ff' : '#ff4444';
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(minimapX, minimapY, isCurrentPlayer ? 3 : 2, 0, Math.PI * 2);
      this.minimapCtx.fill();
    });
    
    this.minimapCtx.restore();
  }
  
  private getBiomeAt(x: number, y: number): any {
    if (!this.world || !this.world.world || !this.world.world.biomeMap) return null;
    
    // Convert pixel coordinates to tile coordinates (like desktop client)
    const tileX = Math.floor(x / 8); // 8 pixels per tile
    const tileY = Math.floor(y / 8);
    const worldSize = this.world.world.size;
    
    // Check bounds
    if (tileX < 0 || tileY < 0 || tileX >= worldSize || tileY >= worldSize) {
      return null;
    }
    
    // Get biome from 2D map
    const biomeType = this.world.world.biomeMap[tileY] && this.world.world.biomeMap[tileY][tileX];
    return biomeType ? { type: biomeType } : null;
  }
  
  private getColorVariance(x: number, y: number): number {
    // Simple pseudo-random variance based on position
    const seed = x * 31 + y * 17;
    return (Math.sin(seed) * 0.1); // ±10% variance
  }
  
  private adjustColor(color: string, variance: number): string {
    // Parse hex color
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Apply variance
    const factor = 1 + variance;
    const newR = Math.max(0, Math.min(255, Math.floor(r * factor)));
    const newG = Math.max(0, Math.min(255, Math.floor(g * factor)));
    const newB = Math.max(0, Math.min(255, Math.floor(b * factor)));
    
    return `rgb(${newR}, ${newG}, ${newB})`;
  }
  
  private getTileColor(tile: any): string {
    // Interior tile colors
    switch (tile) {
      case 'floor': return '#D2B48C';
      case 'wall': return '#8B4513';
      case 'door': return '#654321';
      case 'water': return '#4169E1';
      default: return '#90EE90';
    }
  }
  
  destroy(): void {
    // Clean up any resources
    console.log('🎨 Renderer destroyed');
  }
}