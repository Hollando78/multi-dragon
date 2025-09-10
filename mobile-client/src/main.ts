import { PWAManager } from '@/pwa/PWAManager';
import { AppShell } from '@/components/AppShell';

class DragonIsleApp {
  private pwaManager: PWAManager;
  private appShell: AppShell;
  
  constructor() {
    this.pwaManager = new PWAManager();
    this.appShell = new AppShell();
  }
  
  async init(): Promise<void> {
    console.log('🐉 Dragon Isle Mobile starting...');
    
    // Initialize PWA features
    await this.pwaManager.init();
    
    // Initialize app shell
    await this.appShell.init();
    
    // Hide loading screen
    this.hideLoadingScreen();
    
    // Show welcome page
    this.showWelcomePage();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('🐉 Dragon Isle Mobile ready!');
  }
  
  private hideLoadingScreen(): void {
    const loading = document.getElementById('loading');
    if (loading) {
      setTimeout(() => {
        loading.style.opacity = '0';
        setTimeout(() => loading.remove(), 300);
      }, 1000);
    }
  }
  
  private showWelcomePage(): void {
    const welcome = document.getElementById('welcome');
    if (welcome) {
      welcome.classList.add('active');
    }
  }
  
  private setupEventListeners(): void {
    // Play button
    const playButton = document.getElementById('playButton');
    if (playButton) {
      playButton.addEventListener('click', () => {
        window.location.href = '/login.html';
      });
    }
    
    // PWA install prompt
    const installButton = document.getElementById('installButton');
    const dismissInstall = document.getElementById('dismissInstall');
    
    if (installButton) {
      installButton.addEventListener('click', () => {
        this.pwaManager.installApp();
      });
    }
    
    if (dismissInstall) {
      dismissInstall.addEventListener('click', () => {
        this.pwaManager.dismissInstallPrompt();
      });
    }
    
    // Show install prompt when available
    this.pwaManager.onInstallPromptAvailable(() => {
      const prompt = document.getElementById('installPrompt');
      if (prompt) {
        prompt.classList.add('show');
      }
    });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new DragonIsleApp();
  await app.init();
});

// Handle service worker updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 New service worker activated, reloading...');
    window.location.reload();
  });
}

// Handle offline/online events
window.addEventListener('online', () => {
  console.log('🌐 Connection restored');
});

window.addEventListener('offline', () => {
  console.log('📴 Connection lost - running offline');
});