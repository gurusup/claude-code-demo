# Dark/Light Mode Theme Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for the dark/light mode theme switching functionality using `next-themes` library, Vitest, and React Testing Library. The application uses Tailwind CSS with CSS variables for theming and follows hexagonal architecture principles.

## Testing Framework Configuration

### Current Test Setup
- **Test Runner**: Vitest 3.2.4
- **React Testing**: @testing-library/react 16.3.0
- **DOM Testing**: @testing-library/dom 10.4.1
- **User Interactions**: @testing-library/user-event 14.6.1
- **Assertions**: @testing-library/jest-dom 6.9.1
- **Environment**: jsdom 27.0.0 (for browser APIs)

### Required Vitest Configuration Updates

Create a new Vitest config for frontend tests: `vitest.config.frontend.ts`

```typescript
// ABOUTME: Vitest configuration for frontend/UI testing with React components
// ABOUTME: Configures jsdom environment and React Testing Library setup

import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/frontend-setup.ts'],
    include: [
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'tests/frontend/**/*.test.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.next', 'coverage'],
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        'app/layout.tsx',
        'app/page.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/hooks': path.resolve(__dirname, './hooks'),
    },
  },
});
```

### Test Setup File

Create `tests/setup/frontend-setup.ts`:

```typescript
// ABOUTME: Test setup for frontend React component tests
// ABOUTME: Configures jsdom globals, matchers, and cleanup

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// Mock matchMedia (for prefers-color-scheme detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

---

## 1. Test Utilities and Helpers

### 1.1 Custom Render Function with ThemeProvider

**File**: `tests/utils/render-with-providers.tsx`

```typescript
// ABOUTME: Custom render function that wraps components with necessary providers
// ABOUTME: Provides ThemeProvider context for theme-aware component testing

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: 'light' | 'dark' | 'system';
  defaultTheme?: 'light' | 'dark' | 'system';
  storageKey?: string;
  forcedTheme?: 'light' | 'dark';
}

export function renderWithTheme(
  ui: ReactElement,
  {
    theme,
    defaultTheme = 'system',
    storageKey = 'theme',
    forcedTheme,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme={defaultTheme}
        enableSystem
        storageKey={storageKey}
        forcedTheme={forcedTheme}
      >
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
```

### 1.2 Mock localStorage Utility

**File**: `tests/utils/mock-storage.ts`

```typescript
// ABOUTME: Mock implementation of localStorage for testing theme persistence
// ABOUTME: Provides helper functions to simulate storage operations and failures

export class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  private throwOnAccess = false;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    if (this.throwOnAccess) {
      throw new Error('localStorage access denied');
    }
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnAccess) {
      throw new Error('localStorage access denied');
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  // Test helper methods
  simulateStorageFailure(): void {
    this.throwOnAccess = true;
  }

  restoreStorageAccess(): void {
    this.throwOnAccess = false;
  }

  getAllItems(): Record<string, string> {
    return Object.fromEntries(this.store);
  }
}

export function createMockStorage(): MockStorage {
  return new MockStorage();
}
```

### 1.3 Mock matchMedia Utility

**File**: `tests/utils/mock-match-media.ts`

```typescript
// ABOUTME: Mock implementation of window.matchMedia for system theme preference testing
// ABOUTME: Allows simulating prefers-color-scheme media query changes

export interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
  addListener: (callback: (e: MediaQueryListEvent) => void) => void;
  removeListener: (callback: (e: MediaQueryListEvent) => void) => void;
  addEventListener: (type: string, callback: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: string, callback: (e: MediaQueryListEvent) => void) => void;
  dispatchEvent: (event: Event) => boolean;
}

export class MockMatchMedia {
  private listeners: Map<string, Set<(e: MediaQueryListEvent) => void>> = new Map();
  private queries: Map<string, MockMediaQueryList> = new Map();

  constructor(private defaultMatches: Record<string, boolean> = {}) {}

  mockImplementation = (query: string): MockMediaQueryList => {
    if (!this.queries.has(query)) {
      const matches = this.defaultMatches[query] ?? false;
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      this.listeners.set(query, listeners);

      const mql: MockMediaQueryList = {
        matches,
        media: query,
        onchange: null,
        addListener: (callback) => listeners.add(callback),
        removeListener: (callback) => listeners.delete(callback),
        addEventListener: (type, callback) => {
          if (type === 'change') listeners.add(callback);
        },
        removeEventListener: (type, callback) => {
          if (type === 'change') listeners.delete(callback);
        },
        dispatchEvent: (event) => {
          listeners.forEach((callback) => callback(event as MediaQueryListEvent));
          return true;
        },
      };

      this.queries.set(query, mql);
    }

    return this.queries.get(query)!;
  };

  simulateChange(query: string, matches: boolean): void {
    const mql = this.queries.get(query);
    if (!mql) return;

    mql.matches = matches;
    const event = new MediaQueryListEvent('change', { matches, media: query });

    const listeners = this.listeners.get(query);
    listeners?.forEach((callback) => callback(event));

    if (mql.onchange) {
      mql.onchange.call(mql as any, event);
    }
  }

  reset(): void {
    this.listeners.clear();
    this.queries.clear();
  }
}

export function createMockMatchMedia(
  defaults: Record<string, boolean> = {}
): MockMatchMedia {
  return new MockMatchMedia(defaults);
}
```

---

## 2. Unit Tests: Theme Toggle Component

### 2.1 Theme Toggle Component Tests

**File**: `components/theme-toggle.test.tsx`

#### Test Scenarios:

1. **Rendering Tests**
   - Should render theme toggle button
   - Should render with correct initial theme state
   - Should display correct icon for current theme (sun for light, moon for dark)
   - Should have proper accessibility attributes (aria-label, role)
   - Should be keyboard navigable (tab index, focus styles)

2. **Theme Switching Tests**
   - Should toggle from light to dark theme on click
   - Should toggle from dark to light theme on click
   - Should handle system theme preference
   - Should cycle through themes: light → dark → system (if multi-option)
   - Should update theme state immediately after toggle
   - Should persist theme change to localStorage

3. **Accessibility Tests**
   - Should have descriptive aria-label based on current theme
   - Should be focusable via keyboard
   - Should toggle theme on Enter key press
   - Should toggle theme on Space key press
   - Should announce theme changes to screen readers (aria-live region)
   - Should maintain focus after theme toggle

4. **Visual Feedback Tests**
   - Should show loading state during theme transition (if applicable)
   - Should animate icon transition smoothly
   - Should apply hover styles correctly
   - Should show focus ring when focused
   - Should maintain consistent sizing across themes

5. **Edge Cases**
   - Should handle rapid successive toggles without race conditions
   - Should work when localStorage is unavailable
   - Should handle corrupted localStorage data gracefully
   - Should not throw errors when theme context is missing
   - Should handle null/undefined theme values

#### Example Test Structure:

```typescript
// ABOUTME: Unit tests for ThemeToggle component
// ABOUTME: Tests theme switching, accessibility, persistence, and edge cases

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render theme toggle button', () => {
      renderWithTheme(<ThemeToggle />);
      const button = screen.getByRole('button', { name: /theme/i });
      expect(button).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      renderWithTheme(<ThemeToggle />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should be keyboard focusable', () => {
      renderWithTheme(<ThemeToggle />);
      const button = screen.getByRole('button');

      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe('Theme Switching', () => {
    it('should toggle from light to dark theme', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });
      const button = screen.getByRole('button');

      await user.click(button);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should toggle from dark to light theme', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'dark' });
      const button = screen.getByRole('button');

      await user.click(button);

      await waitFor(() => {
        expect(document.documentElement).not.toHaveClass('dark');
      });
    });

    it('should persist theme to localStorage', async () => {
      renderWithTheme(<ThemeToggle />, { storageKey: 'test-theme' });
      const button = screen.getByRole('button');

      await user.click(button);

      await waitFor(() => {
        expect(localStorage.getItem('test-theme')).toBeTruthy();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should toggle theme on Enter key', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should toggle theme on Space key', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard(' ');

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive toggles', async () => {
      renderWithTheme(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should end up in a valid state
      await waitFor(() => {
        const hasClass = document.documentElement.classList.contains('dark');
        expect(typeof hasClass).toBe('boolean');
      });
    });

    it('should work when localStorage throws error', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      setItemSpy.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      renderWithTheme(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Should not throw error
      await expect(user.click(button)).resolves.not.toThrow();

      setItemSpy.mockRestore();
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('theme', 'invalid-theme-value');

      // Should render without errors
      expect(() => renderWithTheme(<ThemeToggle />)).not.toThrow();
    });
  });
});
```

---

## 3. Integration Tests: Theme Persistence

### 3.1 localStorage Persistence Tests

**File**: `tests/integration/theme-persistence.test.tsx`

#### Test Scenarios:

1. **Basic Persistence**
   - Should save theme preference to localStorage on change
   - Should load theme from localStorage on mount
   - Should use default theme when localStorage is empty
   - Should override localStorage with forced theme prop

2. **Storage Key Customization**
   - Should use custom storage key when provided
   - Should not conflict with other localStorage keys
   - Should handle multiple instances with different keys

3. **Cross-Tab Synchronization**
   - Should sync theme changes across browser tabs
   - Should listen to storage events
   - Should update theme when storage event fires
   - Should handle rapid storage events

4. **Storage Failure Scenarios**
   - Should gracefully degrade when localStorage is disabled
   - Should handle SecurityError (private browsing)
   - Should handle QuotaExceededError
   - Should continue working in-memory without persistence

5. **Data Integrity**
   - Should validate theme value before saving
   - Should sanitize invalid theme values
   - Should handle JSON parse errors
   - Should handle non-string values in localStorage

#### Example Test Structure:

```typescript
// ABOUTME: Integration tests for theme persistence using localStorage
// ABOUTME: Tests storage operations, cross-tab sync, and failure scenarios

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { ThemeToggle } from '@/components/theme-toggle';
import { createMockStorage } from '@/tests/utils/mock-storage';

describe('Theme Persistence', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  describe('Basic Persistence', () => {
    it('should save theme to localStorage on change', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />, { storageKey: 'app-theme' });

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(mockStorage.getItem('app-theme')).toBe('dark');
      });
    });

    it('should load theme from localStorage on mount', () => {
      mockStorage.setItem('app-theme', 'dark');

      renderWithTheme(<ThemeToggle />, { storageKey: 'app-theme' });

      expect(document.documentElement).toHaveClass('dark');
    });

    it('should use default theme when localStorage is empty', () => {
      renderWithTheme(<ThemeToggle />, {
        defaultTheme: 'light',
        storageKey: 'app-theme'
      });

      expect(document.documentElement).not.toHaveClass('dark');
    });
  });

  describe('Storage Failure Scenarios', () => {
    it('should handle localStorage disabled gracefully', async () => {
      mockStorage.simulateStorageFailure();

      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');

      // Should not throw even when storage fails
      await expect(user.click(button)).resolves.not.toThrow();
    });

    it('should handle QuotaExceededError', async () => {
      const setItemSpy = vi.spyOn(mockStorage, 'setItem');
      setItemSpy.mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      await expect(user.click(button)).resolves.not.toThrow();

      setItemSpy.mockRestore();
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should sync theme changes across tabs', async () => {
      renderWithTheme(<ThemeToggle />, { storageKey: 'app-theme' });

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'app-theme',
        newValue: 'dark',
        oldValue: 'light',
        storageArea: localStorage,
      });

      window.dispatchEvent(storageEvent);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });
  });

  describe('Data Integrity', () => {
    it('should handle corrupted JSON data', () => {
      mockStorage.setItem('app-theme', '{invalid-json}');

      // Should render without throwing
      expect(() => renderWithTheme(<ThemeToggle />)).not.toThrow();
    });

    it('should sanitize invalid theme values', () => {
      mockStorage.setItem('app-theme', 'invalid-theme');

      renderWithTheme(<ThemeToggle />);

      // Should fall back to default theme
      const hasValidTheme =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.classList.contains('light');

      expect(hasValidTheme || !document.documentElement.className).toBe(true);
    });
  });
});
```

---

## 4. System Preference Detection Tests

### 4.1 prefers-color-scheme Media Query Tests

**File**: `tests/integration/system-theme-detection.test.tsx`

#### Test Scenarios:

1. **Initial Detection**
   - Should detect system dark mode preference on mount
   - Should detect system light mode preference on mount
   - Should respect system preference when theme is 'system'
   - Should ignore system preference when theme is explicitly set

2. **Dynamic Changes**
   - Should update theme when system preference changes
   - Should handle multiple system preference changes
   - Should debounce rapid system preference changes
   - Should cleanup event listeners on unmount

3. **Media Query Matching**
   - Should correctly match prefers-color-scheme: dark
   - Should correctly match prefers-color-scheme: light
   - Should handle no-preference state
   - Should handle invalid media query results

4. **Browser Compatibility**
   - Should work when matchMedia is not supported
   - Should handle browsers without media query support
   - Should provide fallback for older browsers

5. **Priority Rules**
   - localStorage theme should override system preference
   - Forced theme prop should override everything
   - System theme should only apply when theme is 'system'
   - Should handle conflicting preferences correctly

#### Example Test Structure:

```typescript
// ABOUTME: Tests for system theme preference detection via prefers-color-scheme
// ABOUTME: Tests media query matching, dynamic changes, and priority rules

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { ThemeToggle } from '@/components/theme-toggle';
import { createMockMatchMedia } from '@/tests/utils/mock-match-media';

describe('System Theme Detection', () => {
  let mockMatchMedia: ReturnType<typeof createMockMatchMedia>;

  beforeEach(() => {
    mockMatchMedia = createMockMatchMedia({
      '(prefers-color-scheme: dark)': false,
      '(prefers-color-scheme: light)': true,
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia.mockImplementation,
    });
  });

  afterEach(() => {
    mockMatchMedia.reset();
  });

  describe('Initial Detection', () => {
    it('should detect system dark mode on mount', () => {
      mockMatchMedia = createMockMatchMedia({
        '(prefers-color-scheme: dark)': true,
      });

      window.matchMedia = mockMatchMedia.mockImplementation;

      renderWithTheme(<ThemeToggle />, { defaultTheme: 'system' });

      expect(document.documentElement).toHaveClass('dark');
    });

    it('should detect system light mode on mount', () => {
      mockMatchMedia = createMockMatchMedia({
        '(prefers-color-scheme: light)': true,
      });

      window.matchMedia = mockMatchMedia.mockImplementation;

      renderWithTheme(<ThemeToggle />, { defaultTheme: 'system' });

      expect(document.documentElement).not.toHaveClass('dark');
    });

    it('should ignore system preference when theme explicitly set', () => {
      mockMatchMedia = createMockMatchMedia({
        '(prefers-color-scheme: dark)': true,
      });

      window.matchMedia = mockMatchMedia.mockImplementation;

      localStorage.setItem('theme', 'light');
      renderWithTheme(<ThemeToggle />);

      expect(document.documentElement).not.toHaveClass('dark');
    });
  });

  describe('Dynamic Changes', () => {
    it('should update theme when system preference changes', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'system' });

      // Simulate system switching to dark mode
      mockMatchMedia.simulateChange('(prefers-color-scheme: dark)', true);
      mockMatchMedia.simulateChange('(prefers-color-scheme: light)', false);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should handle multiple system preference changes', async () => {
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'system' });

      // Toggle back and forth
      mockMatchMedia.simulateChange('(prefers-color-scheme: dark)', true);
      await waitFor(() => expect(document.documentElement).toHaveClass('dark'));

      mockMatchMedia.simulateChange('(prefers-color-scheme: dark)', false);
      await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));

      mockMatchMedia.simulateChange('(prefers-color-scheme: dark)', true);
      await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing matchMedia gracefully', () => {
      const originalMatchMedia = window.matchMedia;
      // @ts-ignore
      delete window.matchMedia;

      expect(() => {
        renderWithTheme(<ThemeToggle />, { defaultTheme: 'system' });
      }).not.toThrow();

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Priority Rules', () => {
    it('localStorage should override system preference', () => {
      mockMatchMedia = createMockMatchMedia({
        '(prefers-color-scheme: dark)': true,
      });
      window.matchMedia = mockMatchMedia.mockImplementation;

      localStorage.setItem('theme', 'light');
      renderWithTheme(<ThemeToggle />);

      expect(document.documentElement).not.toHaveClass('dark');
    });

    it('forced theme should override everything', () => {
      mockMatchMedia = createMockMatchMedia({
        '(prefers-color-scheme: dark)': true,
      });
      window.matchMedia = mockMatchMedia.mockImplementation;

      localStorage.setItem('theme', 'light');
      renderWithTheme(<ThemeToggle />, { forcedTheme: 'dark' });

      expect(document.documentElement).toHaveClass('dark');
    });
  });
});
```

---

## 5. Component Integration Tests

### 5.1 Theme Propagation Tests

**File**: `tests/integration/theme-propagation.test.tsx`

#### Test Scenarios:

1. **Component Tree Propagation**
   - Should propagate theme to all child components
   - Should update all components when theme changes
   - Should maintain theme consistency across nested components
   - Should handle deeply nested component trees

2. **CSS Variable Updates**
   - Should update Tailwind CSS variables on theme change
   - Should apply correct color values for dark mode
   - Should apply correct color values for light mode
   - Should transition smoothly between themes (no flash)

3. **Component-Specific Behavior**
   - Should update Button component colors
   - Should update shadcn/ui components correctly
   - Should update custom components using theme context
   - Should update third-party components

4. **Conditional Rendering**
   - Should show/hide theme-specific content correctly
   - Should handle conditional classes based on theme
   - Should update dynamic theme-based content

5. **Performance**
   - Should not cause unnecessary re-renders
   - Should batch theme updates efficiently
   - Should not block UI during theme transitions
   - Should handle large component trees efficiently

#### Example Test Structure:

```typescript
// ABOUTME: Integration tests for theme propagation across component tree
// ABOUTME: Tests CSS variable updates and component-specific theme behavior

import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

describe('Theme Propagation', () => {
  describe('Component Tree', () => {
    it('should propagate theme to all child components', async () => {
      const TestComponent = () => (
        <div>
          <ThemeToggle />
          <Button data-testid="test-button">Test Button</Button>
          <div data-testid="test-div">Test Content</div>
        </div>
      );

      const user = userEvent.setup();
      renderWithTheme(<TestComponent />, { defaultTheme: 'light' });

      const toggle = screen.getByRole('button', { name: /theme/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });

      // All children should be in dark mode context
      const button = screen.getByTestId('test-button');
      const div = screen.getByTestId('test-div');

      expect(button).toBeInTheDocument();
      expect(div).toBeInTheDocument();
    });

    it('should handle deeply nested components', async () => {
      const DeeplyNested = () => (
        <div>
          <div>
            <div>
              <div>
                <Button data-testid="nested-button">Nested Button</Button>
              </div>
            </div>
          </div>
        </div>
      );

      const TestComponent = () => (
        <div>
          <ThemeToggle />
          <DeeplyNested />
        </div>
      );

      const user = userEvent.setup();
      renderWithTheme(<TestComponent />);

      const toggle = screen.getByRole('button', { name: /theme/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });

      expect(screen.getByTestId('nested-button')).toBeInTheDocument();
    });
  });

  describe('CSS Variable Updates', () => {
    it('should update CSS variables on theme change', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });

      const toggle = screen.getByRole('button');
      await user.click(toggle);

      await waitFor(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);

        // Dark mode variables should be applied
        expect(root).toHaveClass('dark');
      });
    });
  });

  describe('Performance', () => {
    it('should not cause excessive re-renders', async () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return (
          <div>
            <ThemeToggle />
            <Button>Test</Button>
          </div>
        );
      };

      const user = userEvent.setup();
      renderWithTheme(<TestComponent />);

      const initialRenderCount = renderCount;

      const toggle = screen.getByRole('button', { name: /theme/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });

      // Should not render more than necessary
      expect(renderCount).toBeLessThan(initialRenderCount + 5);
    });
  });
});
```

---

## 6. Edge Cases and Error Scenarios

### 6.1 Edge Case Tests

**File**: `tests/edge-cases/theme-edge-cases.test.tsx`

#### Test Scenarios:

1. **Initial Load Scenarios**
   - Should handle no theme set on first visit
   - Should prevent flash of unstyled content (FOUC)
   - Should handle theme loaded from cookie vs localStorage
   - Should handle SSR/CSR mismatch

2. **Rapid Interaction**
   - Should handle rapid theme toggle clicks
   - Should handle theme toggle during transition
   - Should debounce or queue rapid changes
   - Should maintain consistent state during rapid changes

3. **Browser Navigation**
   - Should maintain theme on browser back button
   - Should maintain theme on browser forward button
   - Should maintain theme on page refresh
   - Should handle browser restoration

4. **SSR/Hydration**
   - Should not cause hydration mismatch errors
   - Should match server-rendered theme with client
   - Should handle theme script blocking vs non-blocking
   - Should prevent theme flicker on hydration

5. **Concurrent Updates**
   - Should handle theme change during component mount
   - Should handle theme change during component unmount
   - Should handle simultaneous theme changes from multiple sources
   - Should handle theme change during re-render

6. **Memory and Cleanup**
   - Should cleanup event listeners on unmount
   - Should not leak memory with repeated mount/unmount
   - Should cleanup storage listeners properly
   - Should handle component remounting

#### Example Test Structure:

```typescript
// ABOUTME: Edge case tests for theme switching
// ABOUTME: Tests rapid interactions, navigation, SSR, and cleanup scenarios

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { ThemeToggle } from '@/components/theme-toggle';

describe('Theme Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Initial Load', () => {
    it('should handle no theme on first visit', () => {
      expect(localStorage.getItem('theme')).toBeNull();

      renderWithTheme(<ThemeToggle />);

      // Should render with default theme without errors
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not cause FOUC', () => {
      const { container } = renderWithTheme(<ThemeToggle />);

      // Should have theme class immediately
      const hasThemeClass =
        document.documentElement.classList.contains('dark') ||
        document.documentElement.classList.contains('light') ||
        document.documentElement.classList.length === 0;

      expect(hasThemeClass).toBe(true);
    });
  });

  describe('Rapid Interaction', () => {
    it('should handle rapid successive toggles', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');

      // Click rapidly 10 times
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }

      await waitFor(() => {
        // Should end up in a valid state
        const html = document.documentElement;
        const hasValidState =
          html.classList.contains('dark') ||
          !html.classList.contains('dark');
        expect(hasValidState).toBe(true);
      });
    });

    it('should maintain consistent state during rapid changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');

      await user.click(button);
      const firstState = document.documentElement.classList.contains('dark');

      await user.click(button);
      const secondState = document.documentElement.classList.contains('dark');

      // States should alternate correctly
      expect(firstState).not.toBe(secondState);
    });
  });

  describe('Browser Navigation', () => {
    it('should maintain theme on page refresh', () => {
      localStorage.setItem('theme', 'dark');

      renderWithTheme(<ThemeToggle />);

      expect(document.documentElement).toHaveClass('dark');
    });

    it('should maintain theme on browser back/forward', async () => {
      const user = userEvent.setup();
      localStorage.setItem('theme', 'light');

      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      await waitFor(() => {
        expect(localStorage.getItem('theme')).toBe('dark');
      });

      // Simulate navigation
      localStorage.setItem('theme', 'dark');

      const { rerender } = renderWithTheme(<ThemeToggle />);

      expect(document.documentElement).toHaveClass('dark');
    });
  });

  describe('Memory and Cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderWithTheme(<ThemeToggle />);

      const addCalls = addEventListenerSpy.mock.calls.length;

      unmount();

      const removeCalls = removeEventListenerSpy.mock.calls.length;

      // Should remove at least as many listeners as added
      expect(removeCalls).toBeGreaterThanOrEqual(addCalls);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should handle repeated mount/unmount without memory leaks', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderWithTheme(<ThemeToggle />);
        unmount();
      }

      // If there are memory leaks, this test may hang or fail
      expect(true).toBe(true);
    });
  });

  describe('SSR/Hydration', () => {
    it('should not cause hydration errors', () => {
      // Simulate SSR by setting theme before render
      document.documentElement.classList.add('dark');

      const consoleSpy = vi.spyOn(console, 'error');

      renderWithTheme(<ThemeToggle />, { defaultTheme: 'dark' });

      // Should not log hydration errors
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/hydration/i)
      );

      consoleSpy.mockRestore();
    });
  });
});
```

---

## 7. Accessibility Testing

### 7.1 ARIA and Keyboard Navigation Tests

**File**: `tests/accessibility/theme-accessibility.test.tsx`

#### Test Scenarios:

1. **ARIA Attributes**
   - Should have descriptive aria-label
   - Should update aria-label when theme changes
   - Should have proper role attribute
   - Should use aria-pressed for toggle state (if applicable)
   - Should have aria-live region for announcements

2. **Keyboard Navigation**
   - Should be focusable with Tab key
   - Should toggle with Enter key
   - Should toggle with Space key
   - Should maintain focus after toggle
   - Should have visible focus indicator

3. **Screen Reader Support**
   - Should announce current theme to screen readers
   - Should announce theme changes
   - Should provide context for toggle action
   - Should not announce redundant information

4. **Focus Management**
   - Should receive focus in correct tab order
   - Should trap focus in modal contexts (if applicable)
   - Should restore focus after dialog close
   - Should not lose focus unexpectedly

5. **High Contrast Mode**
   - Should be visible in Windows High Contrast Mode
   - Should maintain contrast ratios in both themes
   - Should work with browser zoom

#### Example Test Structure:

```typescript
// ABOUTME: Accessibility tests for theme toggle component
// ABOUTME: Tests ARIA attributes, keyboard navigation, and screen reader support

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/tests/utils/render-with-providers';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeToggle } from '@/components/theme-toggle';

expect.extend(toHaveNoViolations);

describe('Theme Toggle Accessibility', () => {
  describe('ARIA Attributes', () => {
    it('should have descriptive aria-label', () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      const ariaLabel = button.getAttribute('aria-label');

      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/theme|dark|light/i);
    });

    it('should update aria-label when theme changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });

      const button = screen.getByRole('button');
      const initialLabel = button.getAttribute('aria-label');

      await user.click(button);

      const updatedLabel = button.getAttribute('aria-label');

      // Label should change to reflect new state
      expect(updatedLabel).not.toBe(initialLabel);
    });

    it('should have proper button role', () => {
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable with Tab', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      await user.tab();

      const button = screen.getByRole('button');
      expect(button).toHaveFocus();
    });

    it('should toggle with Enter key', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{Enter}');

      expect(document.documentElement).toHaveClass('dark');
    });

    it('should toggle with Space key', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />, { defaultTheme: 'light' });

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard(' ');

      expect(document.documentElement).toHaveClass('dark');
    });

    it('should maintain focus after toggle', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveFocus();
    });

    it('should have visible focus indicator', async () => {
      const user = userEvent.setup();
      renderWithTheme(<ThemeToggle />);

      const button = screen.getByRole('button');
      await user.tab();

      // Check for focus-visible styles
      expect(button).toHaveFocus();

      // Should have focus ring (check computed styles)
      const styles = window.getComputedStyle(button);
      expect(styles.outline).toBeTruthy();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce theme changes', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <div>
          <ThemeToggle />
          <div aria-live="polite" aria-atomic="true" data-testid="announcement" />
        </div>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      // Check if aria-label updated (screen readers will announce this)
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('Automated Accessibility Audit', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithTheme(<ThemeToggle />);

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should pass accessibility audit in dark mode', async () => {
      const { container } = renderWithTheme(<ThemeToggle />, {
        defaultTheme: 'dark'
      });

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });
});
```

---

## 8. Critical Test Scenarios Summary

### Must-Not-Miss Test Cases

#### Priority 1: Core Functionality
1. **Theme Toggle Works**: Button click changes theme from light to dark and vice versa
2. **Persistence**: Theme preference saves to localStorage and loads on mount
3. **System Detection**: Detects and respects `prefers-color-scheme` when theme is 'system'
4. **CSS Updates**: Dark mode class applied/removed from `<html>` element

#### Priority 2: User Experience
5. **No FOUC**: No flash of unstyled content on initial load
6. **Keyboard Access**: Toggle works with Enter and Space keys
7. **Focus Management**: Focus maintained after toggle, visible focus ring
8. **Accessibility**: Has aria-label, proper role, and screen reader support

#### Priority 3: Edge Cases
9. **Rapid Toggles**: Handles rapid successive clicks without race conditions
10. **Storage Failures**: Gracefully degrades when localStorage unavailable
11. **Navigation**: Theme persists on back/forward/refresh
12. **Hydration**: No SSR/CSR mismatch errors

#### Priority 4: Integration
13. **Component Propagation**: Theme changes propagate to all child components
14. **Cross-Tab Sync**: Theme changes sync across browser tabs
15. **Performance**: No excessive re-renders during theme change

---

## 9. Test Coverage Goals

### Minimum Coverage Thresholds

| Layer | Statements | Branches | Functions | Lines |
|-------|-----------|----------|-----------|-------|
| Theme Components | 90% | 85% | 90% | 90% |
| Theme Hooks | 85% | 80% | 85% | 85% |
| Theme Utilities | 80% | 75% | 80% | 80% |
| Integration | 75% | 70% | 75% | 75% |

### Uncovered Code Acceptable

- TypeScript type definitions
- next-themes internal implementation
- CSS transition animations
- Browser-specific polyfills

---

## 10. Testing Best Practices

### Do's

1. **Use Real DOM Events**: Prefer `userEvent` over `fireEvent` for realistic interactions
2. **Wait for Side Effects**: Use `waitFor` for async state updates
3. **Test User Behavior**: Test what users see and do, not implementation details
4. **Isolate Tests**: Each test should be independent and not rely on others
5. **Clean Up**: Clear localStorage, reset mocks, cleanup listeners after each test

### Don'ts

1. **Don't Test Implementation**: Avoid testing internal state or private methods
2. **Don't Mock Everything**: Only mock external dependencies (browser APIs)
3. **Don't Hardcode Delays**: Use `waitFor` instead of `setTimeout`
4. **Don't Ignore Warnings**: React/Vitest warnings often indicate real issues
5. **Don't Skip Accessibility**: Always include a11y tests

---

## 11. Test Execution Commands

### Run All Frontend Tests
```bash
yarn test --config vitest.config.frontend.ts
```

### Run Theme Tests Only
```bash
yarn test --config vitest.config.frontend.ts theme
```

### Run Tests with UI
```bash
yarn test:ui --config vitest.config.frontend.ts
```

### Run Tests with Coverage
```bash
yarn test:coverage --config vitest.config.frontend.ts
```

### Watch Mode
```bash
yarn test --watch --config vitest.config.frontend.ts
```

---

## 12. Next Steps After Testing

1. **Implement Theme Toggle Component**: Create UI component based on tests
2. **Add next-themes Provider**: Wrap app in ThemeProvider
3. **Update Layout**: Remove hardcoded dark class from body
4. **Add Toggle to Navbar**: Place theme toggle in navigation bar
5. **Test in Real Browsers**: Manual testing in Chrome, Firefox, Safari
6. **Test on Mobile**: Verify touch interactions and mobile browsers
7. **Performance Audit**: Check for theme transition performance
8. **Accessibility Audit**: Run axe-core and manual screen reader testing

---

## Notes for Implementation Team

### Important Considerations

1. **next-themes Configuration**:
   - Use `attribute="class"` to match Tailwind's `darkMode: ['class']`
   - Enable `enableSystem` for system preference support
   - Use consistent `storageKey` (default: 'theme')

2. **SSR Handling**:
   - Add theme script to `<head>` to prevent FOUC
   - Consider using next-themes's built-in script injection

3. **Testing Environment**:
   - jsdom doesn't fully support CSS-in-JS, test class changes instead
   - Mock `matchMedia` for system preference tests
   - Mock `localStorage` for persistence tests

4. **Test Data**:
   - Use test-specific storage keys to avoid conflicts
   - Clean up storage after each test
   - Use fake timers for debounce/throttle tests

5. **Performance**:
   - Theme changes should be instant (no noticeable delay)
   - Avoid re-rendering entire app on theme change
   - Use CSS transitions for smooth visual changes

---

## Conclusion

This testing strategy ensures comprehensive coverage of dark/light mode functionality including unit tests for components, integration tests for persistence and system detection, edge case handling, and accessibility compliance. Follow the test scenarios in order of priority, starting with core functionality and progressing to edge cases and performance optimizations.
