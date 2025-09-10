interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class PWAManager {
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private onInstallPromptCallback: (() => void) | null = null;
  
  async init(): Promise<void> {
    await this.registerServiceWorker();
    this.setupInstallPrompt();
    this.handleAppInstalled();
  }
  
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('✅ Service Worker registered:', registration.scope);
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New service worker available');
                this.showUpdatePrompt();
              }
            });
          }
        });
        
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }
  }
  
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      
      if (this.onInstallPromptCallback) {
        this.onInstallPromptCallback();
      }
    });
  }
  
  private handleAppInstalled(): void {
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.dismissInstallPrompt();
    });
  }
  
  onInstallPromptAvailable(callback: () => void): void {
    this.onInstallPromptCallback = callback;
    
    // If prompt is already available, call immediately
    if (this.installPrompt) {
      callback();
    }
  }
  
  async installApp(): Promise<void> {
    if (!this.installPrompt) {
      console.warn('Install prompt not available');
      return;
    }
    
    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        console.log('✅ User accepted the install prompt');
      } else {
        console.log('❌ User dismissed the install prompt');
      }
      
      this.installPrompt = null;
    } catch (error) {
      console.error('❌ Install prompt failed:', error);
    }
  }
  
  dismissInstallPrompt(): void {
    this.installPrompt = null;
    
    const prompt = document.getElementById('installPrompt');
    if (prompt) {
      prompt.classList.remove('show');
    }
  }
  
  private showUpdatePrompt(): void {
    // Create update notification
    const updatePrompt = document.createElement('div');
    updatePrompt.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      background: rgba(0, 128, 255, 0.9);
      backdrop-filter: blur(10px);
      padding: 1rem;
      border-radius: 8px;
      color: white;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 1rem;
    `;
    
    updatePrompt.innerHTML = `
      <div style="flex: 1;">
        <strong>Update Available</strong><br>
        <small>A new version of Dragon Isle is ready!</small>
      </div>
      <button id="updateButton" style="
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        cursor: pointer;
      ">Update</button>
      <button id="dismissUpdate" style="
        padding: 0.5rem;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 1.2rem;
      ">×</button>
    `;
    
    document.body.appendChild(updatePrompt);
    
    // Handle update button
    const updateButton = updatePrompt.querySelector('#updateButton');
    updateButton?.addEventListener('click', () => {
      window.location.reload();
    });
    
    // Handle dismiss button
    const dismissButton = updatePrompt.querySelector('#dismissUpdate');
    dismissButton?.addEventListener('click', () => {
      updatePrompt.remove();
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (updatePrompt.parentNode) {
        updatePrompt.remove();
      }
    }, 10000);
  }
  
  isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           (window.navigator as any).standalone === true;
  }
  
  getInstallationState(): 'not-supported' | 'available' | 'installed' {
    if (!('serviceWorker' in navigator) || !('BeforeInstallPromptEvent' in window)) {
      return 'not-supported';
    }
    
    if (this.isStandalone()) {
      return 'installed';
    }
    
    return this.installPrompt ? 'available' : 'not-supported';
  }
}