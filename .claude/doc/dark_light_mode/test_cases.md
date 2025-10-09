# Dark/Light Mode Feature - Test Cases Documentation

## Overview
This document defines comprehensive test cases for the dark/light mode theme switching feature. The implementation will use `next-themes` library (already installed) and follow React Testing Library + Vitest best practices.

## Test File Structure

```
__tests__/
├── components/
│   ├── ThemeProvider.test.tsx       # Provider wrapper tests
│   ├── ThemeToggle.test.tsx         # Toggle component unit tests
│   └── navbar.test.tsx              # Integration with navbar
├── integration/
│   └── theme-switching.test.tsx     # End-to-end theme switching flows
└── setup/
    └── test-utils.tsx               # Custom render with providers
```

## Testing Stack Setup Requirements

### Dependencies to Add
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.4",
    "@testing-library/user-event": "^14.5.1",
    "vitest": "^1.0.4",
    "@vitest/ui": "^1.0.4",
    "jsdom": "^23.0.0",
    "happy-dom": "^12.10.3"
  }
}
```

### Configuration Files Needed
1. `vitest.config.ts` - Vitest configuration
2. `__tests__/setup/vitest-setup.ts` - Global test setup
3. `__tests__/setup/test-utils.tsx` - Custom render utilities

---

## 1. Unit Tests - ThemeToggle Component

**File**: `__tests__/components/ThemeToggle.test.tsx`

### Test Suite: ThemeToggle Component Rendering

#### Test 1.1: Renders toggle button with correct initial state
```typescript
it('should render theme toggle button', () => {
  render(<ThemeToggle />)
  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
  expect(toggleButton).toBeInTheDocument()
})
```

#### Test 1.2: Shows correct icon for light theme
```typescript
it('should display sun icon when theme is light', () => {
  mockUseTheme({ theme: 'light' })
  render(<ThemeToggle />)
  expect(screen.getByTestId('sun-icon')).toBeInTheDocument()
})
```

#### Test 1.3: Shows correct icon for dark theme
```typescript
it('should display moon icon when theme is dark', () => {
  mockUseTheme({ theme: 'dark' })
  render(<ThemeToggle />)
  expect(screen.getByTestId('moon-icon')).toBeInTheDocument()
})
```

#### Test 1.4: Shows correct icon for system theme
```typescript
it('should display system icon when theme is system', () => {
  mockUseTheme({ theme: 'system' })
  render(<ThemeToggle />)
  expect(screen.getByTestId('system-icon')).toBeInTheDocument()
})
```

### Test Suite: ThemeToggle User Interactions

#### Test 2.1: Toggles from light to dark on click
```typescript
it('should switch from light to dark theme when clicked', async () => {
  const user = userEvent.setup()
  const setTheme = vi.fn()
  mockUseTheme({ theme: 'light', setTheme })

  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  expect(setTheme).toHaveBeenCalledWith('dark')
})
```

#### Test 2.2: Toggles from dark to light on click
```typescript
it('should switch from dark to light theme when clicked', async () => {
  const user = userEvent.setup()
  const setTheme = vi.fn()
  mockUseTheme({ theme: 'dark', setTheme })

  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  expect(setTheme).toHaveBeenCalledWith('light')
})
```

#### Test 2.3: Handles keyboard navigation (Enter key)
```typescript
it('should toggle theme when Enter key is pressed', async () => {
  const user = userEvent.setup()
  const setTheme = vi.fn()
  mockUseTheme({ theme: 'light', setTheme })

  render(<ThemeToggle />)
  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
  toggleButton.focus()
  await user.keyboard('{Enter}')

  expect(setTheme).toHaveBeenCalledWith('dark')
})
```

#### Test 2.4: Handles keyboard navigation (Space key)
```typescript
it('should toggle theme when Space key is pressed', async () => {
  const user = userEvent.setup()
  const setTheme = vi.fn()
  mockUseTheme({ theme: 'light', setTheme })

  render(<ThemeToggle />)
  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
  toggleButton.focus()
  await user.keyboard(' ')

  expect(setTheme).toHaveBeenCalledWith('dark')
})
```

### Test Suite: ThemeToggle Accessibility

#### Test 3.1: Has correct ARIA attributes
```typescript
it('should have proper aria-label for accessibility', () => {
  render(<ThemeToggle />)
  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

  expect(toggleButton).toHaveAttribute('aria-label')
  expect(toggleButton.getAttribute('aria-label')).toMatch(/toggle theme|switch theme/i)
})
```

#### Test 3.2: Button is keyboard focusable
```typescript
it('should be focusable via keyboard', async () => {
  const user = userEvent.setup()
  render(<ThemeToggle />)

  await user.tab()
  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

  expect(toggleButton).toHaveFocus()
})
```

#### Test 3.3: Has visible focus indicator
```typescript
it('should have visible focus indicator when focused', async () => {
  const user = userEvent.setup()
  render(<ThemeToggle />)

  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })
  await user.tab()

  // Verify focus-visible styles are applied
  expect(toggleButton).toHaveClass(/focus-visible/)
})
```

#### Test 3.4: Announces theme changes to screen readers
```typescript
it('should update aria-label when theme changes', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<ThemeToggle />)

  mockUseTheme({ theme: 'light' })
  rerender(<ThemeToggle />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', expect.stringContaining('light'))

  mockUseTheme({ theme: 'dark' })
  rerender(<ThemeToggle />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-label', expect.stringContaining('dark'))
})
```

---

## 2. Unit Tests - ThemeProvider Component

**File**: `__tests__/components/ThemeProvider.test.tsx`

### Test Suite: ThemeProvider Initialization

#### Test 4.1: Wraps children correctly
```typescript
it('should render children within ThemeProvider', () => {
  render(
    <ThemeProvider>
      <div data-testid="child">Test Child</div>
    </ThemeProvider>
  )

  expect(screen.getByTestId('child')).toBeInTheDocument()
})
```

#### Test 4.2: Provides theme context to children
```typescript
it('should provide theme context to nested components', () => {
  const TestComponent = () => {
    const { theme } = useTheme()
    return <div data-testid="theme-value">{theme}</div>
  }

  render(
    <ThemeProvider defaultTheme="dark">
      <TestComponent />
    </ThemeProvider>
  )

  expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
})
```

#### Test 4.3: Applies correct initial theme
```typescript
it('should apply default theme on mount', () => {
  render(
    <ThemeProvider defaultTheme="light">
      <div>Content</div>
    </ThemeProvider>
  )

  // Verify HTML element has correct class
  expect(document.documentElement).toHaveClass('light')
})
```

### Test Suite: ThemeProvider Configuration

#### Test 5.1: Supports attribute-based theme application
```typescript
it('should apply theme as attribute when configured', () => {
  render(
    <ThemeProvider attribute="data-theme" defaultTheme="dark">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})
```

#### Test 5.2: Enables storage persistence
```typescript
it('should enable localStorage persistence when configured', () => {
  const localStorageMock = createLocalStorageMock()
  global.localStorage = localStorageMock

  render(
    <ThemeProvider storageKey="app-theme" defaultTheme="dark">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(localStorageMock.getItem).toHaveBeenCalledWith('app-theme')
})
```

#### Test 5.3: Disables transitions on theme change
```typescript
it('should disable transitions during theme change when configured', async () => {
  const { rerender } = render(
    <ThemeProvider disableTransitionOnChange defaultTheme="light">
      <div>Content</div>
    </ThemeProvider>
  )

  mockUseTheme({ theme: 'dark' })
  rerender(
    <ThemeProvider disableTransitionOnChange defaultTheme="dark">
      <div>Content</div>
    </ThemeProvider>
  )

  // Verify transition-disabling class is temporarily added
  expect(document.documentElement).toHaveStyle({ transition: 'none' })
})
```

---

## 3. Integration Tests - Theme Persistence

**File**: `__tests__/integration/theme-persistence.test.tsx`

### Test Suite: localStorage Integration

#### Test 6.1: Saves theme preference to localStorage
```typescript
it('should persist theme selection to localStorage', async () => {
  const user = userEvent.setup()
  const localStorageMock = createLocalStorageMock()
  global.localStorage = localStorageMock

  render(
    <ThemeProvider storageKey="app-theme">
      <ThemeToggle />
    </ThemeProvider>
  )

  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  expect(localStorageMock.setItem).toHaveBeenCalledWith(
    'app-theme',
    expect.stringMatching(/light|dark/)
  )
})
```

#### Test 6.2: Loads theme from localStorage on mount
```typescript
it('should restore theme from localStorage on initialization', () => {
  const localStorageMock = createLocalStorageMock()
  localStorageMock.getItem.mockReturnValue('dark')
  global.localStorage = localStorageMock

  render(
    <ThemeProvider storageKey="app-theme">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('dark')
})
```

#### Test 6.3: Handles missing localStorage gracefully
```typescript
it('should fall back to default theme when localStorage is unavailable', () => {
  const originalLocalStorage = global.localStorage
  // @ts-ignore - Simulate localStorage unavailable
  delete global.localStorage

  render(
    <ThemeProvider defaultTheme="light">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('light')

  global.localStorage = originalLocalStorage
})
```

#### Test 6.4: Handles corrupted localStorage data
```typescript
it('should handle invalid localStorage data gracefully', () => {
  const localStorageMock = createLocalStorageMock()
  localStorageMock.getItem.mockReturnValue('invalid-theme-value')
  global.localStorage = localStorageMock

  render(
    <ThemeProvider storageKey="app-theme" defaultTheme="light">
      <div>Content</div>
    </ThemeProvider>
  )

  // Should fall back to default theme
  expect(document.documentElement).toHaveClass('light')
})
```

---

## 4. Integration Tests - System Preference Detection

**File**: `__tests__/integration/system-preferences.test.tsx`

### Test Suite: matchMedia Integration

#### Test 7.1: Detects system dark mode preference
```typescript
it('should detect and apply system dark mode preference', () => {
  mockMatchMedia({ matches: true, media: '(prefers-color-scheme: dark)' })

  render(
    <ThemeProvider defaultTheme="system">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('dark')
})
```

#### Test 7.2: Detects system light mode preference
```typescript
it('should detect and apply system light mode preference', () => {
  mockMatchMedia({ matches: false, media: '(prefers-color-scheme: dark)' })

  render(
    <ThemeProvider defaultTheme="system">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('light')
})
```

#### Test 7.3: Listens for system preference changes
```typescript
it('should update theme when system preference changes', async () => {
  const matchMediaMock = mockMatchMedia({ matches: false })

  render(
    <ThemeProvider defaultTheme="system">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('light')

  // Simulate system preference change
  act(() => {
    matchMediaMock.triggerChange({ matches: true })
  })

  await waitFor(() => {
    expect(document.documentElement).toHaveClass('dark')
  })
})
```

#### Test 7.4: Handles matchMedia unavailability
```typescript
it('should handle environments without matchMedia support', () => {
  const originalMatchMedia = window.matchMedia
  // @ts-ignore
  delete window.matchMedia

  render(
    <ThemeProvider defaultTheme="system">
      <div>Content</div>
    </ThemeProvider>
  )

  // Should fall back gracefully (likely to light theme)
  expect(document.documentElement.classList).toContain(expect.stringMatching(/light|dark/))

  window.matchMedia = originalMatchMedia
})
```

---

## 5. Integration Tests - Navbar Integration

**File**: `__tests__/components/navbar.test.tsx`

### Test Suite: Navbar with Theme Toggle

#### Test 8.1: Renders navbar with theme toggle
```typescript
it('should render navbar with theme toggle button', () => {
  render(
    <ThemeProvider>
      <Navbar />
    </ThemeProvider>
  )

  expect(screen.getByRole('button', { name: /view source code/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /deploy with vercel/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
})
```

#### Test 8.2: Theme toggle positioned correctly in navbar
```typescript
it('should position theme toggle in navbar layout', () => {
  render(
    <ThemeProvider>
      <Navbar />
    </ThemeProvider>
  )

  const navbar = screen.getByRole('navigation') || screen.getByTestId('navbar')
  const themeToggle = screen.getByRole('button', { name: /toggle theme/i })

  expect(navbar).toContainElement(themeToggle)
})
```

#### Test 8.3: Maintains navbar functionality with theme changes
```typescript
it('should maintain all navbar links when theme changes', async () => {
  const user = userEvent.setup()

  render(
    <ThemeProvider>
      <Navbar />
    </ThemeProvider>
  )

  const githubLink = screen.getByRole('button', { name: /view source code/i })

  // Toggle theme
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  // Navbar links should still be present and functional
  expect(githubLink).toBeInTheDocument()
  expect(githubLink.closest('a')).toHaveAttribute('href', expect.stringContaining('github'))
})
```

---

## 6. Integration Tests - Full Theme Switching Flow

**File**: `__tests__/integration/theme-switching.test.tsx`

### Test Suite: Complete Theme Switching Workflow

#### Test 9.1: Complete light to dark switch workflow
```typescript
it('should complete full light to dark theme switch', async () => {
  const user = userEvent.setup()
  const localStorageMock = createLocalStorageMock()
  global.localStorage = localStorageMock

  render(
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <Navbar />
      <div data-testid="content">App Content</div>
    </ThemeProvider>
  )

  // Initial state
  expect(document.documentElement).toHaveClass('light')

  // User clicks toggle
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  // Verify theme changed
  await waitFor(() => {
    expect(document.documentElement).toHaveClass('dark')
  })

  // Verify persistence
  expect(localStorageMock.setItem).toHaveBeenCalledWith('app-theme', 'dark')

  // Verify icon changed
  expect(screen.getByTestId('moon-icon')).toBeInTheDocument()
})
```

#### Test 9.2: Multiple rapid theme toggles
```typescript
it('should handle rapid theme toggles correctly', async () => {
  const user = userEvent.setup()

  render(
    <ThemeProvider defaultTheme="light">
      <ThemeToggle />
    </ThemeProvider>
  )

  const toggleButton = screen.getByRole('button', { name: /toggle theme/i })

  // Rapid clicks
  await user.click(toggleButton)
  await user.click(toggleButton)
  await user.click(toggleButton)

  // Should end up back at dark (3 toggles from light)
  await waitFor(() => {
    expect(document.documentElement).toHaveClass('dark')
  })
})
```

#### Test 9.3: Theme persists across component remounts
```typescript
it('should maintain theme across component remounts', () => {
  const localStorageMock = createLocalStorageMock()
  localStorageMock.getItem.mockReturnValue('dark')
  global.localStorage = localStorageMock

  const { unmount } = render(
    <ThemeProvider storageKey="app-theme">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('dark')

  unmount()

  // Remount
  render(
    <ThemeProvider storageKey="app-theme">
      <div>Content</div>
    </ThemeProvider>
  )

  expect(document.documentElement).toHaveClass('dark')
  expect(localStorageMock.getItem).toHaveBeenCalledWith('app-theme')
})
```

---

## 7. Edge Cases and Error Scenarios

**File**: `__tests__/integration/edge-cases.test.tsx`

### Test Suite: Edge Cases

#### Test 10.1: Handles SSR/CSR hydration mismatch
```typescript
it('should prevent hydration mismatch during SSR', () => {
  // Simulate server-rendered content
  const serverHTML = `<html class="light"><body><div id="root">Content</div></body></html>`
  document.body.innerHTML = serverHTML

  render(
    <ThemeProvider defaultTheme="dark">
      <div>Content</div>
    </ThemeProvider>
  )

  // Should not cause hydration errors
  expect(document.documentElement).toHaveClass('dark')
})
```

#### Test 10.2: Handles undefined theme gracefully
```typescript
it('should handle undefined theme value gracefully', () => {
  mockUseTheme({ theme: undefined })

  render(<ThemeToggle />)

  // Should render without crashing
  expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
})
```

#### Test 10.3: Prevents theme flash on page load (FOUC)
```typescript
it('should prevent flash of unstyled content on initial load', () => {
  const localStorageMock = createLocalStorageMock()
  localStorageMock.getItem.mockReturnValue('dark')
  global.localStorage = localStorageMock

  // Verify theme is applied before React hydrates
  render(
    <ThemeProvider storageKey="app-theme">
      <div>Content</div>
    </ThemeProvider>
  )

  // Theme should be applied synchronously
  expect(document.documentElement).toHaveClass('dark')
})
```

#### Test 10.4: Handles concurrent theme changes from multiple sources
```typescript
it('should handle theme changes from storage events (multiple tabs)', async () => {
  const localStorageMock = createLocalStorageMock()
  global.localStorage = localStorageMock

  render(
    <ThemeProvider storageKey="app-theme" defaultTheme="light">
      <div>Content</div>
    </ThemeProvider>
  )

  // Simulate storage event from another tab
  const storageEvent = new StorageEvent('storage', {
    key: 'app-theme',
    newValue: 'dark',
    storageArea: localStorage
  })

  act(() => {
    window.dispatchEvent(storageEvent)
  })

  await waitFor(() => {
    expect(document.documentElement).toHaveClass('dark')
  })
})
```

---

## 8. Performance Tests

**File**: `__tests__/integration/performance.test.tsx`

### Test Suite: Performance

#### Test 11.1: Theme toggle responds within acceptable time
```typescript
it('should toggle theme within 100ms', async () => {
  const user = userEvent.setup()

  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  )

  const startTime = performance.now()
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))
  const endTime = performance.now()

  expect(endTime - startTime).toBeLessThan(100)
})
```

#### Test 11.2: Does not cause unnecessary re-renders
```typescript
it('should not trigger unnecessary re-renders', async () => {
  const renderSpy = vi.fn()

  const TestComponent = () => {
    const { theme } = useTheme()
    renderSpy()
    return <div>{theme}</div>
  }

  const user = userEvent.setup()

  render(
    <ThemeProvider>
      <TestComponent />
      <ThemeToggle />
    </ThemeProvider>
  )

  const initialRenderCount = renderSpy.mock.calls.length

  // Toggle theme
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))

  // Should only re-render once for theme change
  expect(renderSpy).toHaveBeenCalledTimes(initialRenderCount + 1)
})
```

---

## Mocking Strategy

### 1. localStorage Mock

```typescript
// __tests__/setup/mocks/localStorage.ts
export const createLocalStorageMock = () => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
}
```

### 2. matchMedia Mock

```typescript
// __tests__/setup/mocks/matchMedia.ts
export const mockMatchMedia = (options: { matches: boolean; media?: string } = { matches: false }) => {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []

  const matchMediaMock = {
    matches: options.matches,
    media: options.media || '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn((listener) => listeners.push(listener)),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event, listener) => {
      if (event === 'change') listeners.push(listener)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    triggerChange: (newState: { matches: boolean }) => {
      const event = new Event('change') as MediaQueryListEvent
      Object.defineProperty(event, 'matches', { value: newState.matches })
      listeners.forEach(listener => listener(event))
    }
  }

  window.matchMedia = vi.fn(() => matchMediaMock as any)

  return matchMediaMock
}
```

### 3. useTheme Hook Mock

```typescript
// __tests__/setup/mocks/useTheme.ts
import { vi } from 'vitest'

export const mockUseTheme = (overrides: Partial<ReturnType<typeof useTheme>> = {}) => {
  const defaultValues = {
    theme: 'light',
    setTheme: vi.fn(),
    systemTheme: undefined,
    themes: ['light', 'dark', 'system'],
    resolvedTheme: 'light',
    ...overrides
  }

  vi.mock('next-themes', () => ({
    useTheme: () => defaultValues,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children
  }))

  return defaultValues
}
```

---

## Custom Test Utilities

### Custom Render Function

```typescript
// __tests__/setup/test-utils.tsx
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'

interface CustomRenderOptions extends RenderOptions {
  theme?: string
  enableSystemTheme?: boolean
}

export const render = (
  ui: React.ReactElement,
  {
    theme = 'light',
    enableSystemTheme = false,
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider
      defaultTheme={theme}
      enableSystem={enableSystemTheme}
      storageKey="test-theme"
    >
      {children}
    </ThemeProvider>
  )

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from RTL
export * from '@testing-library/react'
export { render }
```

---

## Coverage Expectations

### Component Coverage Targets
- **ThemeProvider**: 95% coverage
  - All props and configurations tested
  - Edge cases covered

- **ThemeToggle**: 100% coverage
  - All user interactions
  - All accessibility features
  - All theme states

### Integration Test Coverage
- **Theme Switching**: 100% of user flows
- **Persistence**: All storage scenarios
- **System Preferences**: All matchMedia scenarios

### Overall Coverage Goals
- **Statements**: ≥ 90%
- **Branches**: ≥ 85%
- **Functions**: ≥ 90%
- **Lines**: ≥ 90%

---

## Test Execution Plan

### Phase 1: Setup (Before Implementation)
1. Install testing dependencies
2. Configure Vitest
3. Create test utilities and mocks
4. Set up CI/CD test pipeline

### Phase 2: Unit Tests (During Implementation)
1. Write ThemeToggle component tests
2. Write ThemeProvider wrapper tests
3. Achieve 100% unit test coverage

### Phase 3: Integration Tests (After Basic Implementation)
1. Write theme persistence tests
2. Write system preference tests
3. Write navbar integration tests
4. Test edge cases

### Phase 4: E2E Tests (Final Validation)
1. Full theme switching workflows
2. Performance benchmarks
3. Accessibility validation
4. Cross-browser compatibility (if applicable)

---

## Test Maintenance Guidelines

### When to Update Tests
- **Component API Changes**: Update mocks and assertions
- **New Theme Options**: Add test cases for new themes
- **Bug Fixes**: Add regression tests
- **Accessibility Improvements**: Enhance accessibility test coverage

### Test Naming Convention
```typescript
// Format: should [expected behavior] when [condition]
it('should toggle theme when button is clicked', async () => {})
it('should persist theme when user changes preference', async () => {})
it('should handle keyboard navigation when user presses Enter', async () => {})
```

### Best Practices
1. **Arrange-Act-Assert**: Follow AAA pattern consistently
2. **User-Centric**: Test from user's perspective (RTL philosophy)
3. **Isolated**: Each test should be independent
4. **Fast**: Keep tests under 100ms when possible
5. **Readable**: Use descriptive test names and clear assertions
6. **Maintainable**: Avoid testing implementation details

---

## Continuous Integration

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "yarn test:unit --run",
      "pre-push": "yarn test --coverage"
    }
  }
}
```

### CI Pipeline Steps
1. Install dependencies
2. Run linter
3. Run unit tests with coverage
4. Run integration tests
5. Generate coverage report
6. Fail if coverage < 85%

---

## Success Criteria

### Definition of Done for Tests
- [ ] All unit tests passing (100% of ThemeToggle and ThemeProvider)
- [ ] All integration tests passing (persistence, system preferences, navbar)
- [ ] All edge cases covered
- [ ] Code coverage ≥ 90%
- [ ] All accessibility tests passing
- [ ] Performance tests within acceptable thresholds
- [ ] Tests documented and maintainable
- [ ] CI pipeline configured and passing

---

## Additional Resources

### Reference Documentation
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest API Reference](https://vitest.dev/api/)
- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)

### Related Files to Reference
- `/Users/franciscopastor/Documents/repos/cabify-demo/components/ui/button.tsx` - Button component pattern
- `/Users/franciscopastor/Documents/repos/cabify-demo/components/navbar.tsx` - Navbar integration point
- `/Users/franciscopastor/Documents/repos/cabify-demo/app/layout.tsx` - Root layout for provider injection

---

**Document Version**: 1.0
**Last Updated**: 2025-10-05
**Author**: frontend-test-engineer
**Status**: Ready for Implementation
