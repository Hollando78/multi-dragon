import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualJoystick, JoystickData } from '@/controls/VirtualJoystick';

// Mock DOM elements
const mockContainer = {
  querySelector: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  classList: { add: vi.fn(), remove: vi.fn() },
  dispatchEvent: vi.fn()
};

const mockBase = {
  offsetWidth: 140,
  offsetHeight: 140,
  getBoundingClientRect: () => ({
    left: 20,
    top: 20,
    width: 140,
    height: 140
  })
};

const mockKnob = {
  offsetWidth: 60,
  offsetHeight: 60,
  style: {
    transform: '',
    transition: ''
  }
};

// Mock document.getElementById
Object.defineProperty(global, 'document', {
  value: {
    getElementById: vi.fn((id: string) => {
      if (id === 'test-joystick') return mockContainer;
      return null;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
});

describe('VirtualJoystick', () => {
  let joystick: VirtualJoystick;
  let onMoveCallback: vi.MockedFunction<(data: JoystickData) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mock container structure
    mockContainer.querySelector.mockImplementation((selector: string) => {
      if (selector === '.joystick-base') return mockBase;
      if (selector === '.joystick-knob') return mockKnob;
      return null;
    });

    onMoveCallback = vi.fn();
  });

  it('should initialize correctly', () => {
    joystick = new VirtualJoystick('test-joystick', onMoveCallback);
    
    expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
    expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    expect(mockContainer.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
    expect(mockContainer.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
  });

  it('should throw error for missing container', () => {
    expect(() => {
      new VirtualJoystick('nonexistent-joystick');
    }).toThrow('Joystick container not found: nonexistent-joystick');
  });

  it('should return correct initial data', () => {
    joystick = new VirtualJoystick('test-joystick');
    const data = joystick.getCurrentData();
    
    expect(data.x).toBe(0);
    expect(data.y).toBe(0);
    expect(data.distance).toBe(0);
    expect(data.isActive).toBe(false);
  });

  it('should reset to center position', () => {
    joystick = new VirtualJoystick('test-joystick');
    joystick.reset();
    
    expect(mockKnob.style.transform).toBe('translate(-50%, -50%)');
    expect(mockContainer.classList.remove).toHaveBeenCalledWith('active');
  });

  it('should set position programmatically', () => {
    joystick = new VirtualJoystick('test-joystick', onMoveCallback);
    joystick.setPosition(0.5, -0.3);
    
    const data = joystick.getCurrentData();
    expect(data.x).toBeCloseTo(0.5, 1);
    expect(data.y).toBeCloseTo(-0.3, 1);
    expect(onMoveCallback).toHaveBeenCalled();
  });

  it('should constrain movement to max distance', () => {
    joystick = new VirtualJoystick('test-joystick', onMoveCallback);
    joystick.setPosition(2.0, 2.0); // Beyond max range
    
    const data = joystick.getCurrentData();
    expect(data.distance).toBeLessThanOrEqual(1.0);
  });

  it('should clean up event listeners on destroy', () => {
    joystick = new VirtualJoystick('test-joystick');
    joystick.destroy();
    
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
  });
});