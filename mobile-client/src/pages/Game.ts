import { AppShell } from '@/components/AppShell';
import { GameEngine } from '@/game/GameEngine';

class GamePage {
  private appShell: AppShell;
  private gameEngine: GameEngine;
  private chatInput: HTMLInputElement;
  private chatSend: HTMLButtonElement;
  private chatToggle: HTMLElement;
  private menuButton: HTMLButtonElement;
  
  private playerName: string = '';
  private worldSeed: string = '';
  
  constructor() {
    this.appShell = new AppShell();
    this.gameEngine = new GameEngine('gameCanvas');
    
    // Get UI elements
    this.chatInput = document.getElementById('chatInput') as HTMLInputElement;
    this.chatSend = document.getElementById('chatSend') as HTMLButtonElement;
    this.chatToggle = document.getElementById('chatToggle') as HTMLElement;
    this.menuButton = document.getElementById('menuButton') as HTMLButtonElement;
    
    if (!this.chatInput || !this.chatSend || !this.chatToggle || !this.menuButton) {
      throw new Error('Required UI elements not found');
    }
  }
  
  async init(): Promise<void> {
    console.log('🎮 Game page initializing...');
    
    try {
      await this.appShell.init();
      
      // Prevent scrolling on game page
      this.appShell.preventScrolling();
      
      // Get URL parameters
      this.parseUrlParameters();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Connect to game server
      await this.connectToGame();
      
      // Start game loop
      this.gameEngine.start();
      
      console.log('✅ Game page initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize game:', error);
      this.appShell.showToast('Failed to connect to game server', 'error');
      
      // Return to login after error
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 3000);
    }
  }
  
  private parseUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    
    this.playerName = urlParams.get('playerName') || '';
    this.worldSeed = urlParams.get('worldSeed') || '';
    
    if (!this.playerName || !this.worldSeed) {
      throw new Error('Missing required parameters: playerName and worldSeed');
    }
    
    console.log(`🎮 Starting game: ${this.playerName} in world ${this.worldSeed}`);
  }
  
  private setupEventListeners(): void {
    // Chat functionality
    this.chatToggle.addEventListener('click', () => {
      this.toggleChat();
    });
    
    this.chatSend.addEventListener('click', () => {
      this.sendChatMessage();
    });
    
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendChatMessage();
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });
    
    // Prevent chat input from affecting game controls
    this.chatInput.addEventListener('focus', () => {
      this.gameEngine.disconnect(); // Temporarily disconnect input
    });
    
    this.chatInput.addEventListener('blur', () => {
      // Re-enable game input when chat loses focus
    });
    
    // Menu button
    this.menuButton.addEventListener('click', () => {
      this.showGameMenu();
    });
    
    // Handle page visibility changes (pause when backgrounded)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('🔇 Game paused (page hidden)');
      } else {
        console.log('🔊 Game resumed (page visible)');
      }
    });
    
    // Handle beforeunload (disconnect cleanly)
    window.addEventListener('beforeunload', () => {
      this.gameEngine.disconnect();
    });
    
    // Handle orientation changes
    window.addEventListener('appshell-orientation-change', () => {
      // Adjust UI for new orientation
      this.adjustUIForOrientation();
    });
  }
  
  private async connectToGame(): Promise<void> {
    this.appShell.showLoading(`Connecting to ${this.worldSeed}...`);
    
    try {
      console.log('🎮 Attempting to connect to game server...');
      console.log('📍 Player:', this.playerName, 'World:', this.worldSeed);
      
      await this.gameEngine.connect(this.worldSeed, this.playerName);
      
      console.log('✅ Successfully connected to game server');
      this.appShell.hideLoading();
      this.appShell.showToast(`Welcome to ${this.worldSeed}!`, 'success');
      
    } catch (error) {
      console.error('❌ Failed to connect to game server:', error);
      this.appShell.hideLoading();
      
      // Show more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      this.appShell.showToast(`Connection failed: ${errorMessage}`, 'error', 5000);
      
      throw error;
    }
  }
  
  private toggleChat(): void {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      const isOpen = chatPanel.classList.contains('open');
      
      if (isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }
  }
  
  private openChat(): void {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      chatPanel.classList.add('open');
      
      // Focus input after animation
      setTimeout(() => {
        this.chatInput.focus();
      }, 300);
      
      // Update toggle text
      const toggleText = this.chatToggle.querySelector('.chat-toggle-text');
      if (toggleText) {
        toggleText.textContent = '💬 Close Chat';
      }
    }
  }
  
  private closeChat(): void {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      chatPanel.classList.remove('open');
      
      // Update toggle text
      const toggleText = this.chatToggle.querySelector('.chat-toggle-text');
      if (toggleText) {
        toggleText.textContent = '💬 Chat';
      }
      
      // Blur input
      this.chatInput.blur();
    }
  }
  
  private sendChatMessage(): void {
    const message = this.chatInput.value.trim();
    
    if (!message) {
      return;
    }
    
    // Send message through game engine
    this.gameEngine.sendChatMessage(message);
    
    // Clear input
    this.chatInput.value = '';
    
    // Close chat after sending
    setTimeout(() => {
      this.closeChat();
    }, 100);
  }
  
  private showGameMenu(): void {
    // Create modal menu
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      touch-action: none;
    `;
    
    menu.innerHTML = `
      <div style="
        background: #2a2a2a;
        border-radius: 12px;
        padding: 2rem;
        max-width: 300px;
        width: 90%;
        text-align: center;
      ">
        <h2 style="color: #0080ff; margin-bottom: 1.5rem;">Game Menu</h2>
        
        <button id="resumeButton" style="
          width: 100%;
          padding: 1rem;
          margin-bottom: 0.5rem;
          background: #0080ff;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 1rem;
          cursor: pointer;
        ">Resume Game</button>
        
        <button id="settingsButton" style="
          width: 100%;
          padding: 1rem;
          margin-bottom: 0.5rem;
          background: #444;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 1rem;
          cursor: pointer;
        ">Settings</button>
        
        <button id="leaveButton" style="
          width: 100%;
          padding: 1rem;
          background: #ff4444;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 1rem;
          cursor: pointer;
        ">Leave Game</button>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    // Handle menu actions
    const resumeButton = menu.querySelector('#resumeButton');
    const settingsButton = menu.querySelector('#settingsButton');
    const leaveButton = menu.querySelector('#leaveButton');
    
    resumeButton?.addEventListener('click', () => {
      menu.remove();
    });
    
    settingsButton?.addEventListener('click', () => {
      menu.remove();
      // TODO: Show settings modal
      this.appShell.showToast('Settings coming soon!', 'info');
    });
    
    leaveButton?.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave the game?')) {
        this.gameEngine.disconnect();
        window.location.href = '/login.html';
      }
    });
    
    // Close menu on outside click
    menu.addEventListener('click', (e) => {
      if (e.target === menu) {
        menu.remove();
      }
    });
  }
  
  private adjustUIForOrientation(): void {
    const isLandscape = window.innerWidth > window.innerHeight;
    
    // Adjust control positions for different orientations
    const controls = document.querySelector('.mobile-controls') as HTMLElement;
    if (controls) {
      if (isLandscape) {
        controls.style.height = '160px';
      } else {
        controls.style.height = '180px';
      }
    }
    
    // Adjust chat panel height
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
      if (isLandscape) {
        chatPanel.style.height = '240px';
      } else {
        chatPanel.style.height = '280px';
      }
    }
    
    console.log(`📱 UI adjusted for ${isLandscape ? 'landscape' : 'portrait'} orientation`);
  }
  
  destroy(): void {
    // Clean up
    this.gameEngine.destroy();
    this.appShell.allowScrolling();
    
    console.log('🎮 Game page destroyed');
  }
}

// Initialize game page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const gamePage = new GamePage();
    await gamePage.init();
    
    // Store reference for cleanup
    (window as any).gamePage = gamePage;
    
  } catch (error) {
    console.error('❌ Failed to initialize game page:', error);
    
    // Show error and redirect
    const appShell = new AppShell();
    await appShell.init();
    appShell.showToast('Failed to start game', 'error');
    
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 2000);
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  const gamePage = (window as any).gamePage;
  if (gamePage && typeof gamePage.destroy === 'function') {
    gamePage.destroy();
  }
});