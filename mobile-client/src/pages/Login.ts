import { AppShell } from '@/components/AppShell';

class LoginPage {
  private appShell: AppShell;
  private form: HTMLFormElement;
  private playerNameInput: HTMLInputElement;
  private worldSeedInput: HTMLInputElement;
  private joinButton: HTMLButtonElement;
  private randomWorldButton: HTMLButtonElement;
  private backButton: HTMLButtonElement;
  
  constructor() {
    this.appShell = new AppShell();
    
    // Get form elements
    this.form = document.getElementById('loginForm') as HTMLFormElement;
    this.playerNameInput = document.getElementById('playerName') as HTMLInputElement;
    this.worldSeedInput = document.getElementById('worldSeed') as HTMLInputElement;
    this.joinButton = document.getElementById('joinButton') as HTMLButtonElement;
    this.randomWorldButton = document.getElementById('randomWorldButton') as HTMLButtonElement;
    this.backButton = document.getElementById('backButton') as HTMLButtonElement;
    
    if (!this.form || !this.playerNameInput || !this.worldSeedInput || 
        !this.joinButton || !this.randomWorldButton || !this.backButton) {
      throw new Error('Required form elements not found');
    }
  }
  
  async init(): Promise<void> {
    console.log('📝 Login page initializing...');
    
    await this.appShell.init();
    this.setupEventListeners();
    this.loadSavedData();
    
    // Focus player name input
    setTimeout(() => {
      this.playerNameInput.focus();
    }, 100);
    
    console.log('✅ Login page initialized');
  }
  
  private setupEventListeners(): void {
    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });
    
    // Back button
    this.backButton.addEventListener('click', () => {
      this.goBack();
    });
    
    // Random world button
    this.randomWorldButton.addEventListener('click', () => {
      this.joinRandomWorld();
    });
    
    // Input validation
    this.playerNameInput.addEventListener('input', () => {
      this.validatePlayerName();
    });
    
    this.worldSeedInput.addEventListener('input', () => {
      this.validateWorldSeed();
    });
    
    // Handle Enter key in inputs
    this.playerNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.worldSeedInput.focus();
      }
    });
    
    this.worldSeedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin();
      }
    });
  }
  
  private loadSavedData(): void {
    // Load previously used player name
    const savedName = localStorage.getItem('dragon-isle-player-name');
    if (savedName) {
      this.playerNameInput.value = savedName;
    }
    
    // Load last used world seed
    const savedSeed = localStorage.getItem('dragon-isle-world-seed');
    if (savedSeed) {
      this.worldSeedInput.value = savedSeed;
    }
  }
  
  private saveData(): void {
    // Save player name and world seed for next time
    localStorage.setItem('dragon-isle-player-name', this.playerNameInput.value.trim());
    localStorage.setItem('dragon-isle-world-seed', this.worldSeedInput.value.trim());
  }
  
  private validatePlayerName(): boolean {
    const name = this.playerNameInput.value.trim();
    const errorEl = document.getElementById('nameError') as HTMLElement;
    
    if (!name) {
      this.showError(errorEl, 'Player name is required');
      return false;
    }
    
    if (name.length < 2) {
      this.showError(errorEl, 'Player name must be at least 2 characters');
      return false;
    }
    
    if (name.length > 20) {
      this.showError(errorEl, 'Player name must be 20 characters or less');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      this.showError(errorEl, 'Player name can only contain letters, numbers, _ and -');
      return false;
    }
    
    this.hideError(errorEl);
    return true;
  }
  
  private validateWorldSeed(): boolean {
    const seed = this.worldSeedInput.value.trim();
    const errorEl = document.getElementById('seedError') as HTMLElement;
    
    // World seed is optional
    if (!seed) {
      this.hideError(errorEl);
      return true;
    }
    
    if (seed.length > 50) {
      this.showError(errorEl, 'World seed must be 50 characters or less');
      return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(seed)) {
      this.showError(errorEl, 'World seed can only contain letters, numbers, _ and -');
      return false;
    }
    
    this.hideError(errorEl);
    return true;
  }
  
  private showError(element: HTMLElement, message: string): void {
    element.textContent = message;
    element.style.display = 'block';
  }
  
  private hideError(element: HTMLElement): void {
    element.style.display = 'none';
  }
  
  private async handleLogin(): Promise<void> {
    if (!this.validatePlayerName() || !this.validateWorldSeed()) {
      return;
    }
    
    const playerName = this.playerNameInput.value.trim();
    const worldSeed = this.worldSeedInput.value.trim() || this.generateRandomSeed();
    
    this.setLoading(true);
    
    try {
      // Save data for future use
      this.saveData();
      
      // Navigate to game with parameters
      const gameUrl = new URL('/game.html', window.location.origin);
      gameUrl.searchParams.set('playerName', playerName);
      gameUrl.searchParams.set('worldSeed', worldSeed);
      
      this.appShell.showLoading('Connecting to world...');
      
      // Short delay for loading animation
      setTimeout(() => {
        window.location.href = gameUrl.toString();
      }, 500);
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      this.appShell.showToast('Failed to connect to game server', 'error');
      this.setLoading(false);
    }
  }
  
  private async joinRandomWorld(): Promise<void> {
    if (!this.validatePlayerName()) {
      return;
    }
    
    const playerName = this.playerNameInput.value.trim();
    const randomSeed = this.generateRandomSeed();
    
    this.worldSeedInput.value = randomSeed;
    await this.handleLogin();
  }
  
  private generateRandomSeed(): string {
    // Generate a memorable random seed
    const adjectives = ['swift', 'brave', 'mystic', 'ancient', 'golden', 'silver', 'crystal', 'emerald'];
    const nouns = ['dragon', 'isle', 'realm', 'kingdom', 'valley', 'peak', 'forest', 'ocean'];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    
    return `${adjective}-${noun}-${number}`;
  }
  
  private setLoading(loading: boolean): void {
    this.joinButton.disabled = loading;
    this.randomWorldButton.disabled = loading;
    this.playerNameInput.disabled = loading;
    this.worldSeedInput.disabled = loading;
    
    if (loading) {
      this.joinButton.textContent = 'Connecting...';
      this.randomWorldButton.textContent = 'Generating...';
    } else {
      this.joinButton.textContent = 'Join World';
      this.randomWorldButton.textContent = 'Random World';
    }
  }
  
  private goBack(): void {
    window.history.back();
  }
}

// Initialize login page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const loginPage = new LoginPage();
    await loginPage.init();
  } catch (error) {
    console.error('❌ Failed to initialize login page:', error);
  }
});