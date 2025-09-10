export class AppShell {
  private currentPage: string = 'welcome';
  
  async init(): Promise<void> {
    console.log('📱 Initializing App Shell...');
    
    // Set up viewport
    this.setupViewport();
    
    // Handle orientation changes
    this.handleOrientationChange();
    
    // Set up navigation
    this.setupNavigation();
    
    console.log('✅ App Shell initialized');
  }
  
  private setupViewport(): void {
    // Prevent zoom on input focus (iOS Safari)
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }
    
    // Handle safe area insets for devices with notches
    document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--safe-area-left', 'env(safe-area-inset-left)');
    document.documentElement.style.setProperty('--safe-area-right', 'env(safe-area-inset-right)');
  }
  
  private handleOrientationChange(): void {
    const handleOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      document.body.classList.toggle('landscape', isLandscape);
      document.body.classList.toggle('portrait', !isLandscape);
      
      // Emit custom event for components to respond (use different event name)
      window.dispatchEvent(new CustomEvent('appshell-orientation-change', {
        detail: { isLandscape, width: window.innerWidth, height: window.innerHeight }
      }));
    };
    
    // Initial setup
    handleOrientation();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientation);
    window.addEventListener('resize', handleOrientation);
  }
  
  private setupNavigation(): void {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
      const page = event.state?.page || 'welcome';
      this.navigateToPage(page, false);
    });
    
    // Set initial history state
    history.replaceState({ page: this.currentPage }, '', window.location.href);
  }
  
  navigateToPage(page: string, pushState: boolean = true): void {
    console.log(`🧭 Navigating to: ${page}`);
    
    // Update history
    if (pushState) {
      history.pushState({ page }, '', `/${page === 'welcome' ? '' : page + '.html'}`);
    }
    
    // Handle page-specific navigation
    switch (page) {
      case 'welcome':
        window.location.href = '/';
        break;
      case 'login':
        window.location.href = '/login.html';
        break;
      case 'game':
        window.location.href = '/game.html';
        break;
      default:
        console.warn(`Unknown page: ${page}`);
        break;
    }
    
    this.currentPage = page;
  }
  
  getCurrentPage(): string {
    return this.currentPage;
  }
  
  // Utility method to prevent scrolling (useful for game pages)
  preventScrolling(): void {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }
  
  // Re-enable scrolling
  allowScrolling(): void {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
  }
  
  // Show/hide loading overlay
  showLoading(message: string = 'Loading...'): void {
    let loading = document.getElementById('loading-overlay');
    
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'loading-overlay';
      loading.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(26, 26, 26, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        z-index: 9999;
        backdrop-filter: blur(5px);
      `;
      
      loading.innerHTML = `
        <div style="
          width: 48px;
          height: 48px;
          border: 3px solid #333;
          border-top: 3px solid #0080ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        "></div>
        <div id="loading-message" style="
          color: #ccc;
          font-size: 16px;
          text-align: center;
        ">${message}</div>
      `;
      
      document.body.appendChild(loading);
    } else {
      const messageEl = loading.querySelector('#loading-message');
      if (messageEl) {
        messageEl.textContent = message;
      }
      loading.style.display = 'flex';
    }
  }
  
  hideLoading(): void {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.style.display = 'none';
    }
  }
  
  // Haptic feedback (if supported)
  vibrate(pattern: number | number[] = 50): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
  
  // Show toast notification
  showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 3000): void {
    const colors = {
      info: '#0080ff',
      success: '#44ff44',
      warning: '#ffaa00',
      error: '#ff4444'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      transform: translateY(-100px);
      transition: transform 0.3s ease;
      text-align: center;
      font-weight: 500;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
    });
    
    // Auto remove
    setTimeout(() => {
      toast.style.transform = 'translateY(-100px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
}