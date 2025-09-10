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
  
  public world: any = null;
  private poiInterior: any = null;
  
  // Rendering config (match desktop client)
  private baseTileSize = 8; // Base tile size in pixels (matches desktop)
  private chunkSize = 64;
  
  // Performance optimizations
  private colorCache: Map<string, string> = new Map();
  private lastCacheClean = 0;
  private lastMinimapUpdate = 0;
  private frameCount = 0;
  
  // Desktop client's exact biome colors and metadata (accessible for walkability validation)
  public biomeData: { [key: string]: { baseColor: string; colorVariance: number; walkable: boolean; name: string } | string } = {
    ocean: {
      name: 'Ocean',
      baseColor: '#1e40af', // deep blue
      colorVariance: 0.15,
      walkable: false
    },
    beach: {
      name: 'Beach', 
      baseColor: '#fbbf24', // sandy yellow
      colorVariance: 0.25,
      walkable: true
    },
    coast: {
      name: 'Coastal Plains',
      baseColor: '#84cc16', // coastal green
      colorVariance: 0.3,
      walkable: true
    },
    grassland: {
      name: 'Grassland',
      baseColor: '#65a30d', // grass green
      colorVariance: 0.4,
      walkable: true
    },
    forest: {
      name: 'Forest',
      baseColor: '#166534', // forest green
      colorVariance: 0.35,
      walkable: true
    },
    savanna: {
      name: 'Savanna',
      baseColor: '#d97706', // warm brown
      colorVariance: 0.4,
      walkable: true
    },
    shrubland: {
      name: 'Shrubland',
      baseColor: '#a3a65a', // olive green
      colorVariance: 0.3,
      walkable: true
    },
    hills: {
      name: 'Hills',
      baseColor: '#a16207', // brown
      colorVariance: 0.25,
      walkable: true
    },
    mountain: {
      name: 'Mountain',
      baseColor: '#6b7280', // gray
      colorVariance: 0.2,
      walkable: false
    },
    alpine: {
      name: 'Alpine',
      baseColor: '#e5e7eb', // light gray
      colorVariance: 0.15,
      walkable: true
    },
    taiga: {
      name: 'Taiga',
      baseColor: '#14532d', // dark green
      colorVariance: 0.3,
      walkable: true
    },
    tundra: {
      name: 'Tundra',
      baseColor: '#d1d5db', // light gray
      colorVariance: 0.2,
      walkable: true
    },
    desert: {
      name: 'Desert',
      baseColor: '#f59e0b', // desert orange
      colorVariance: 0.35,
      walkable: true
    },
    // Legacy support for simple colors
    river: '#4682B4',
    lake: '#1E90FF',
    // Alias support
    plains: {
      name: 'Plains',
      baseColor: '#65a30d', // same as grassland
      colorVariance: 0.4,
      walkable: true
    },
    mountains: {
      name: 'Mountains',
      baseColor: '#6b7280', // same as mountain
      colorVariance: 0.2,
      walkable: false
    }
  };
  
  // Desktop client's exact POI colors
  private poiColors: { [key: string]: string } = {
    'village': '#ef4444',        // red
    'town': '#14b8a6',           // teal  
    'ruined_castle': '#6b7280',  // gray
    'wizards_tower': '#8b5cf6',  // purple
    'dark_cave': '#1f2937',      // dark gray
    'dragon_grounds': '#dc2626', // dark red
    'lighthouse': '#f59e0b',     // orange
    'ancient_circle': '#06b6d4', // cyan
    // Legacy mappings for compatibility
    'cave': '#1f2937',           // dark gray (same as dark_cave)
    'tower': '#8b5cf6',          // purple (same as wizards_tower)
    'ruins': '#6b7280',          // gray (same as ruined_castle)
    'shrine': '#06b6d4'          // cyan (same as ancient_circle)
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
    
    // Update minimap less frequently for better performance (every 10 frames)
    this.frameCount++;
    const now = Date.now();
    if (now - this.lastMinimapUpdate > 200 || this.frameCount % 10 === 0) { // Update every 200ms or 10 frames
      this.renderMinimap(gameState);
      this.lastMinimapUpdate = now;
    }
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
    
    // Mobile optimization: reduce render distance for better performance
    const mobileRenderFactor = 0.75; // Render 25% less area on mobile
    const mobileViewWidth = viewWidth * mobileRenderFactor;
    const mobileViewHeight = viewHeight * mobileRenderFactor;
    
    // Calculate visible tile area with mobile optimization
    const startTileX = Math.max(0, Math.floor((camera.x - mobileViewWidth) / this.baseTileSize));
    const endTileX = Math.ceil((camera.x + mobileViewWidth) / this.baseTileSize);
    const startTileY = Math.max(0, Math.floor((camera.y - mobileViewHeight) / this.baseTileSize));
    const endTileY = Math.ceil((camera.y + mobileViewHeight) / this.baseTileSize);
    
    // Render terrain
    this.renderTerrain(startTileX, endTileX, startTileY, endTileY, camera);
    
    // Render rivers
    this.renderRivers();
    
    // Render roads (before POIs for proper layering)
    this.renderRoads();
    
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
    
    // Batch similar colors together for better performance
    const colorBatches = new Map<string, Array<{x: number, y: number}>>();
    
    // First pass: collect tiles by color
    for (let tileX = startTileX; tileX <= endTileX; tileX++) {
      for (let tileY = startTileY; tileY <= endTileY; tileY++) {
        const pixelX = tileX * this.baseTileSize;
        const pixelY = tileY * this.baseTileSize;
        
        const biome = this.getBiomeAt(pixelX, pixelY);
        if (!biome) continue;
        
        const color = this.getBiomeColor(biome.type, pixelX, pixelY);
        
        if (!colorBatches.has(color)) {
          colorBatches.set(color, []);
        }
        colorBatches.get(color)!.push({x: pixelX, y: pixelY});
      }
    }
    
    // Second pass: render each color batch
    for (const [color, tiles] of colorBatches) {
      this.ctx.fillStyle = color;
      for (const tile of tiles) {
        this.ctx.fillRect(tile.x, tile.y, this.baseTileSize, this.baseTileSize);
      }
    }
  }
  
  private renderRivers(): void {
    if (!this.world.world || !this.world.world.rivers) return;
    
    this.ctx.strokeStyle = this.biomeData.river;
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
  
  private renderRoads(): void {
    if (!this.world.world || !this.world.world.roads) return;
    
    // Use desktop client's exact styling
    this.ctx.strokeStyle = '#8b5a2b'; // Brown color (matches desktop)
    this.ctx.lineWidth = Math.max(1, 2); // Fixed width for mobile performance
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    
    for (const road of this.world.world.roads) {
      if (!road || road.length < 2) continue;
      
      this.ctx.beginPath();
      
      // Convert road points from tile coordinates to pixel coordinates
      for (let i = 0; i < road.length; i++) {
        const point = road[i];
        const pixelX = point.x * this.baseTileSize; // Convert tile to pixels (8px per tile)
        const pixelY = point.y * this.baseTileSize;
        
        if (i === 0) {
          this.ctx.moveTo(pixelX, pixelY);
        } else {
          this.ctx.lineTo(pixelX, pixelY);
        }
      }
      
      this.ctx.stroke();
    }
  }
  
  private renderPOIs(): void {
    if (!this.world.world || !this.world.world.pois) return;
    
    for (const poi of this.world.world.pois) {
      const color = this.poiColors[poi.type] || '#fff';
      
      // Use desktop client's zoom-responsive sizing (mobile default zoom = 1)
      const camera = { zoom: 1 }; // Default zoom, could be passed from gameState if needed
      const poiSize = 6 * camera.zoom;
      
      // Convert tile position to pixel position (desktop client style)
      const pixelX = poi.position.x * this.baseTileSize;
      const pixelY = poi.position.y * this.baseTileSize;
      
      // Draw POI square with desktop client colors
      this.ctx.fillStyle = color;
      this.ctx.fillRect(pixelX - poiSize/2, pixelY - poiSize/2, poiSize, poiSize);
      
      // Add black border (like desktop)
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(pixelX - poiSize/2, pixelY - poiSize/2, poiSize, poiSize);
      
      // Draw POI name above the square (like desktop client)
      // Show name if discovered or if it's a town
      if (poi.discovered || poi.type === 'town' || poi.name) {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${Math.max(8, 8 * camera.zoom)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        
        // Add black outline to text for better visibility
        const text = poi.name || this.getDefaultPOIName(poi.type);
        this.ctx.strokeText(text, pixelX, pixelY - poiSize/2 - 4);
        this.ctx.fillText(text, pixelX, pixelY - poiSize/2 - 4);
      }
    }
  }
  
  private getDefaultPOIName(type: string): string {
    // Fallback names if POI doesn't have a specific name
    const defaultNames: { [key: string]: string } = {
      'village': 'Village',
      'town': 'Town',
      'ruined_castle': 'Ruined Castle',
      'wizards_tower': "Wizard's Tower",
      'dark_cave': 'Dark Cave',
      'dragon_grounds': 'Dragon Grounds',
      'lighthouse': 'Lighthouse',
      'ancient_circle': 'Ancient Circle',
      // Legacy mappings
      'cave': 'Cave',
      'tower': 'Tower',
      'ruins': 'Ruins',
      'shrine': 'Shrine'
    };
    return defaultNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
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
        
        this.minimapCtx.fillStyle = this.getBiomeColor(biome.type, pixelX, pixelY);
        this.minimapCtx.fillRect(minimapX, minimapY, scale * sampleRate, scale * sampleRate);
      }
    }
    
    // Render POIs using tile coordinates with proper colors (like desktop)
    if (this.world.world && this.world.world.pois) {
      for (const poi of this.world.world.pois) {
        // POIs are already in tile coordinates
        const minimapX = offsetX + poi.position.x * scale;
        const minimapY = offsetY + poi.position.y * scale;
        
        // Use the same colors as main view
        this.minimapCtx.fillStyle = this.poiColors[poi.type] || '#fff';
        this.minimapCtx.fillRect(minimapX - 1.5, minimapY - 1.5, 3, 3);
        
        // Add black border like desktop
        this.minimapCtx.strokeStyle = '#000';
        this.minimapCtx.lineWidth = 1;
        this.minimapCtx.strokeRect(minimapX - 1.5, minimapY - 1.5, 3, 3);
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
  
  public getBiomeAt(x: number, y: number): any {
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
  
  // Desktop client's exact multi-octave Perlin noise implementation
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  private hash(x: number, y: number, seed: number = 0): number {
    let h = (x * 374761393 + y * 668265263 + seed * 1013904223) & 0xffffffff;
    h = (h ^ (h >>> 16)) * 0x85ebca6b;
    h = (h ^ (h >>> 13)) * 0xc2b2ae35;
    h = h ^ (h >>> 16);
    return h & 255;
  }
  
  private perlinNoise(x: number, y: number, seed: number = 0): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const a = this.hash(X, Y, seed);
    const b = this.hash(X + 1, Y, seed);
    const c = this.hash(X, Y + 1, seed);
    const d = this.hash(X + 1, Y + 1, seed);
    
    return this.lerp(v, this.lerp(u, this.grad(a, x, y), this.grad(b, x - 1, y)),
                        this.lerp(u, this.grad(c, x, y - 1), this.grad(d, x - 1, y - 1)));
  }
  
  private multiOctaveNoise(x: number, y: number, seed: number = 0, octaves: number = 3): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 0.05; // Start with low frequency for large-scale variation
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += this.perlinNoise(x * frequency, y * frequency, seed + i) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.6; // Each octave contributes less
      frequency *= 2.2; // Each octave doubles frequency for finer detail
    }
    
    return value / maxValue; // Normalize to [-1, 1]
  }
  
  private getBiomeColor(biome: string, x: number, y: number): string {
    // Clean cache periodically to prevent memory leaks
    const now = Date.now();
    if (now - this.lastCacheClean > 5000) { // Clean every 5 seconds
      this.colorCache.clear();
      this.lastCacheClean = now;
    }
    
    // Use tile coordinates for caching (8x8 pixel tiles)
    const tileX = Math.floor(x / 8);
    const tileY = Math.floor(y / 8);
    const cacheKey = `${biome}-${tileX}-${tileY}`;
    
    // Check cache first
    if (this.colorCache.has(cacheKey)) {
      return this.colorCache.get(cacheKey)!;
    }
    
    const data = this.biomeData[biome];
    if (!data || typeof data === 'string') {
      // Legacy support for simple color strings
      const color = typeof data === 'string' ? data : '#808080';
      this.colorCache.set(cacheKey, color);
      return color;
    }
    
    const baseColor = data.baseColor;
    
    // Use single octave noise for mobile performance (much faster)
    const noise = this.perlinNoise(tileX * 0.1, tileY * 0.1, 123);
    
    // Parse hex color
    const hex = baseColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Apply lighter variation for better performance
    const varyAmount = 30; // Reduced for performance
    const dr = Math.floor(noise * varyAmount);
    const dg = Math.floor(noise * varyAmount * 0.8); // Slight variation per channel
    const db = Math.floor(noise * varyAmount * 1.2);
    
    // Clamp to valid range
    const newR = Math.max(0, Math.min(255, r + dr));
    const newG = Math.max(0, Math.min(255, g + dg));
    const newB = Math.max(0, Math.min(255, b + db));
    
    const color = `rgb(${newR}, ${newG}, ${newB})`;
    this.colorCache.set(cacheKey, color);
    return color;
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