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
    if (interior) {
      console.log('Interior details:', {
        width: interior.width,
        height: interior.height,
        tiles: interior.tiles ? `Array[${interior.tiles.length}]` : 'undefined',
        tilesType: typeof interior.tiles,
        firstTile: interior.tiles && interior.tiles.length > 0 ? interior.tiles[0] : 'none'
      });
    }
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
    
    const interior = this.poiInterior;
    
    // Add dark background for caves like desktop client
    if (interior.type === 'dark_cave') {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.fillStyle = '#0f1419'; // Very dark blue-gray background
      this.ctx.fillRect(-rect.width, -rect.height, rect.width * 2, rect.height * 2);
    }
    
    // Use fixed 16px tile size for consistency (like desktop client)
    const tileSize = 16; // Fixed size, not zoom-dependent
    
    // Validate interior data structure
    if (!interior.layout || !Array.isArray(interior.layout)) {
      console.error('POI interior layout data is invalid:', interior);
      return;
    }
    
    // Derive dimensions from layout array (server doesn't send explicit width/height)
    const interiorHeight = interior.layout.length;
    const interiorWidth = interior.layout.length > 0 ? interior.layout[0].length : 0;
    
    if (interiorWidth === 0 || interiorHeight === 0) {
      console.error('POI interior dimensions are invalid:', { width: interiorWidth, height: interiorHeight });
      return;
    }
    
    // Calculate visible area around camera (like desktop client)
    const camera = gameState.camera;
    const viewWidth = this.canvas.width / (gameState.camera?.zoom || 1) / tileSize;
    const viewHeight = this.canvas.height / (gameState.camera?.zoom || 1) / tileSize;
    
    const startX = Math.max(0, Math.floor(camera.x - viewWidth / 2));
    const endX = Math.min(interiorWidth - 1, Math.ceil(camera.x + viewWidth / 2));
    const startY = Math.max(0, Math.floor(camera.y - viewHeight / 2));
    const endY = Math.min(interiorHeight - 1, Math.ceil(camera.y + viewHeight / 2));
    
    // Render interior tiles
    for (let y = startY; y <= endY; y++) {
      if (!interior.layout[y] || !Array.isArray(interior.layout[y])) continue;
      
      for (let x = startX; x <= endX; x++) {
        if (x >= interior.layout[y].length) continue;
        
        const tile = interior.layout[y][x];
        // Convert tile coordinates to screen coordinates (like desktop)
        const screenX = (x - camera.x) * tileSize;
        const screenY = (y - camera.y) * tileSize;
        
        // Render tile based on type
        this.ctx.fillStyle = this.getTileColor(tile);
        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
        
        // Add borders for walls/doors like desktop client
        if (tile && typeof tile === 'object') {
          if (tile.type === 'wall') {
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
          } else if (tile.type === 'door') {
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
          }
        }
      }
    }
    
    // Render entities (NPCs) in interior
    if (interior.entities && Array.isArray(interior.entities)) {
      for (const entity of interior.entities) {
        if (entity.position) {
          // Convert entity tile position to screen coordinates
          const screenX = (entity.position.x - camera.x) * tileSize;
          const screenY = (entity.position.y - camera.y) * tileSize;
          const entitySize = 12;
          
          // Check if this entity is nearby and interactable
          const isNearby = this.isEntityNearPlayer(entity, gameState);
          
          // Render entity based on type (like desktop client)
          this.ctx.fillStyle = this.getEntityColor(entity.type);
          
          if (entity.type === 'dragon_egg') {
            // Draw egg shape (ellipse)
            const eggWidth = entitySize * 0.8;
            const eggHeight = entitySize * 1.2;
            this.ctx.beginPath();
            this.ctx.ellipse(screenX, screenY, eggWidth/2, eggHeight/2, 0, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Add highlight for nearby interactable eggs
            if (isNearby) {
              this.ctx.strokeStyle = '#ffeb3b'; // Bright yellow highlight
              this.ctx.lineWidth = 3;
              this.ctx.stroke();
              
              // Add pulsing glow effect
              const time = Date.now() / 500;
              const glowAlpha = 0.3 + 0.2 * Math.sin(time);
              this.ctx.shadowColor = '#ffeb3b';
              this.ctx.shadowBlur = 8;
              this.ctx.globalAlpha = glowAlpha;
              this.ctx.stroke();
              this.ctx.globalAlpha = 1;
              this.ctx.shadowBlur = 0;
            } else {
              // Regular border for egg
              this.ctx.strokeStyle = '#b45309';
              this.ctx.lineWidth = 2;
              this.ctx.stroke();
            }
          } else {
            // Regular entity rendering
            this.ctx.fillRect(screenX - entitySize/2, screenY - entitySize/2, entitySize, entitySize);
            
            // Add highlight for nearby entities
            if (isNearby) {
              this.ctx.strokeStyle = '#ffeb3b';
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(screenX - entitySize/2, screenY - entitySize/2, entitySize, entitySize);
            }
          }
          
          // Add name label with interaction hint for nearby entities
          if (entity.name) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(entity.name, screenX, screenY - entitySize/2 - 4);
            
            if (isNearby && entity.type === 'dragon_egg') {
              this.ctx.fillStyle = '#ffeb3b';
              this.ctx.font = '10px Arial';
              this.ctx.fillText('⚡ Tap to collect', screenX, screenY + entitySize/2 + 16);
            }
          }
        }
      }
    }
    
    // Render players in interior (using tile coordinates)
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
    
    this.ctx.strokeStyle = '#4682B4'; // River color
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
      
      let renderX = player.x;
      let renderY = player.y;
      
      if (this.poiInterior) {
        // Interior: use tile coordinates directly with camera offset (like desktop)
        const tileSize = 16; // Fixed 16px per tile
        renderX = (player.x - camera.x) * tileSize;
        renderY = (player.y - camera.y) * tileSize;
      }
      // Overworld: use coordinates as-is (pixel coordinates)
      
      this.renderHappyPlayer(renderX, renderY, isCurrentPlayer, player.color, player.name);
    });
  }
  
  private renderHappyPlayer(x: number, y: number, isCurrentPlayer: boolean, playerColor?: string, name?: string): void {
    const size = isCurrentPlayer ? 4 : 3; // Quarter of original size
    
    // Player body (happy little circular character)
    this.ctx.fillStyle = playerColor || (isCurrentPlayer ? '#ffeb3b' : '#4caf50'); // Yellow for current player, green for others
    this.ctx.beginPath();
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Body border
    this.ctx.strokeStyle = isCurrentPlayer ? '#333' : '#2e7d32';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
    
    // Happy face - Eyes
    this.ctx.fillStyle = '#333';
    this.ctx.beginPath();
    // Left eye
    this.ctx.arc(x - size * 0.4, y - size * 0.3, size * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
    // Right eye
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.4, y - size * 0.3, size * 0.15, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Happy face - Smile
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 0.5;
    this.ctx.beginPath();
    this.ctx.arc(x, y + size * 0.1, size * 0.5, 0, Math.PI);
    this.ctx.stroke();
    
    // Little arms (tiny lines extending from body)
    this.ctx.strokeStyle = playerColor || (isCurrentPlayer ? '#ffeb3b' : '#4caf50');
    this.ctx.lineWidth = 1;
    // Left arm
    this.ctx.beginPath();
    this.ctx.moveTo(x - size * 0.8, y - size * 0.2);
    this.ctx.lineTo(x - size * 1.3, y - size * 0.5);
    this.ctx.stroke();
    // Right arm
    this.ctx.beginPath();
    this.ctx.moveTo(x + size * 0.8, y - size * 0.2);
    this.ctx.lineTo(x + size * 1.3, y - size * 0.5);
    this.ctx.stroke();
    
    // Player name (smaller to match character size)
    if (name) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 1;
      this.ctx.font = '8px system-ui';
      this.ctx.textAlign = 'center';
      
      // Add text stroke for better visibility
      this.ctx.strokeText(name || 'Player', x, y - size - 8);
      this.ctx.fillText(name || 'Player', x, y - size - 8);
    }
  }
  
  private renderUI(_gameState: RenderState): void {
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
      
      // Use same colors as main character rendering
      this.minimapCtx.fillStyle = player.color || (isCurrentPlayer ? '#ffeb3b' : '#4caf50');
      this.minimapCtx.beginPath();
      this.minimapCtx.arc(minimapX, minimapY, isCurrentPlayer ? 2 : 1.5, 0, Math.PI * 2); // Smaller to match new character size
      this.minimapCtx.fill();
      
      // Add border for better visibility
      this.minimapCtx.strokeStyle = isCurrentPlayer ? '#333' : '#2e7d32';
      this.minimapCtx.lineWidth = 0.5;
      this.minimapCtx.stroke();
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
    // Handle tile objects with type property
    const tileType = typeof tile === 'object' ? tile.type : tile;
    
    // Match desktop client's exact interior tile colors
    const colors: { [key: string]: string } = {
      // Village interior colors
      grass: '#65a30d',    // green
      road: '#92400e',     // brown
      house: '#374151',    // dark gray  
      tavern: '#7c2d12',   // dark brown
      shop: '#1e40af',     // blue
      door: '#8B4513',     // saddle brown
      
      // Cave interior colors (bright, clearly visible)
      wall: '#64748b',     // light gray (clearly visible)
      floor: '#94a3b8',    // lighter gray (walkable areas)
      entrance: '#fbbf24', // bright yellow (cave entrance)
      
      // Tower-specific cells
      stairs_up: '#22c55e',   // green stairs
      stairs_down: '#ef4444', // red stairs
    };
    
    return colors[tileType] || '#222'; // Dark fallback like desktop
  }

  private isEntityNearPlayer(entity: any, gameState: RenderState): boolean {
    if (!gameState.currentPlayer || !entity.position) return false;
    
    const playerX = gameState.currentPlayer.x;
    const playerY = gameState.currentPlayer.y;
    const INTERACTION_DISTANCE = 1.5; // 1.5 tiles in interior coordinates
    
    const distance = Math.hypot(playerX - entity.position.x, playerY - entity.position.y);
    return distance <= INTERACTION_DISTANCE;
  }

  private getEntityColor(entityType: string): string {
    // Match desktop client's exact entity colors
    const colors: { [key: string]: string } = {
      villager: '#10b981',   // green
      merchant: '#f59e0b',   // orange
      guard: '#dc2626',      // red
      archmage: '#8b5cf6',   // purple
      adept: '#22d3ee',      // cyan
      dragon_egg: '#f59e0b', // golden egg
      keeper: '#eab308',     // yellow
      boat: '#0ea5e9',       // blue
      dragon: '#dc2626',     // red
      junior_dragon: '#f97316', // orange
      thrall: '#9ca3af',     // gray
      prisoner: '#60a5fa',   // blue
      gold_pile: '#eab308',  // yellow
      druid: '#16a34a',      // emerald
      megalith: '#94a3b8',   // slate
      altar: '#fde68a',      // pale gold
      portal: '#7c3aed',     // violet
      bat: '#6b7280',        // gray bat
      slime: '#22c55e'       // green slime
    };
    return colors[entityType] || '#6b7280'; // Gray fallback
  }
  
  destroy(): void {
    // Clean up any resources
    console.log('🎨 Renderer destroyed');
  }
}