import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PWAManager } from '@/pwa/PWAManager';

// Mock service worker
const mockServiceWorker = {
  register: vi.fn(),
  addEventListener: vi.fn()
};

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: mockServiceWorker,
    vibrate: vi.fn()
  },
  writable: true
});

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({
      matches: false
    })),
    location: {
      protocol: 'https:',
      hostname: 'localhost',
      reload: vi.fn()
    }
  },
  writable: true
});

describe('PWAManager', () => {
  let pwaManager: PWAManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful service worker registration
    mockServiceWorker.register.mockResolvedValue({
      scope: '/',
      addEventListener: vi.fn()
    });
    
    pwaManager = new PWAManager();
  });

  it('should initialize correctly', async () => {
    await pwaManager.init();
    
    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/'
    });
  });

  it('should handle service worker registration failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));
    
    await pwaManager.init();
    
    expect(consoleError).toHaveBeenCalledWith('❌ Service Worker registration failed:', expect.any(Error));
    consoleError.mockRestore();
  });

  it('should detect standalone mode correctly', () => {
    // Mock standalone PWA
    (window as any).matchMedia = vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)'
    }));
    
    expect(pwaManager.isStandalone()).toBe(true);
  });

  it('should detect non-standalone mode correctly', () => {
    expect(pwaManager.isStandalone()).toBe(false);
  });

  it('should return correct installation state', () => {
    expect(pwaManager.getInstallationState()).toBe('not-supported');
  });

  it('should handle install prompt availability', (done) => {
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };

    pwaManager.onInstallPromptAvailable(() => {
      done();
    });

    // Simulate beforeinstallprompt event
    const eventHandler = (window.addEventListener as any).mock.calls
      .find(call => call[0] === 'beforeinstallprompt')[1];
    
    if (eventHandler) {
      eventHandler(mockEvent);
    }

    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should install app when prompt is available', async () => {
    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' })
    };

    // Set up install prompt
    const eventHandler = (window.addEventListener as any).mock.calls
      .find(call => call[0] === 'beforeinstallprompt')?.[1];
    
    if (eventHandler) {
      eventHandler(mockEvent);
    }

    await pwaManager.installApp();
    
    expect(mockEvent.prompt).toHaveBeenCalled();
  });

  it('should handle missing install prompt gracefully', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await pwaManager.installApp();
    
    expect(consoleWarn).toHaveBeenCalledWith('Install prompt not available');
    consoleWarn.mockRestore();
  });

  it('should dismiss install prompt', () => {
    // Mock DOM element
    const mockElement = {
      classList: {
        remove: vi.fn()
      }
    };
    
    (global as any).document = {
      getElementById: vi.fn(() => mockElement)
    };

    pwaManager.dismissInstallPrompt();
    
    expect(mockElement.classList.remove).toHaveBeenCalledWith('show');
  });
});