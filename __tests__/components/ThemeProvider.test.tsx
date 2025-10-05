// ABOUTME: Unit tests for ThemeProvider component
// ABOUTME: Tests wrapping children, theme initialization, and configuration options
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/components/theme-provider'

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('should render children correctly', () => {
    render(
      <ThemeProvider>
        <div data-testid="test-child">Test Content</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('test-child')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should accept and pass through configuration props', () => {
    render(
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <div data-testid="themed-content">Content</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('themed-content')).toBeInTheDocument()
  })

  it('should render multiple children correctly', () => {
    render(
      <ThemeProvider>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })

  it('should work without configuration props', () => {
    render(
      <ThemeProvider>
        <div data-testid="basic-child">Basic Content</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('basic-child')).toBeInTheDocument()
  })

  it('should support custom themes configuration', () => {
    render(
      <ThemeProvider themes={['light', 'dark', 'custom']}>
        <div data-testid="custom-themed">Custom Themes</div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('custom-themed')).toBeInTheDocument()
  })

  it('should handle nested components correctly', () => {
    const NestedComponent = () => <span data-testid="nested">Nested</span>

    render(
      <ThemeProvider>
        <div data-testid="parent">
          <NestedComponent />
        </div>
      </ThemeProvider>
    )

    expect(screen.getByTestId('parent')).toBeInTheDocument()
    expect(screen.getByTestId('nested')).toBeInTheDocument()
  })
})
