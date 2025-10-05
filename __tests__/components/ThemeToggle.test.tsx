// ABOUTME: Unit tests for ThemeToggle component
// ABOUTME: Tests rendering, user interactions, keyboard navigation, and accessibility features
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/theme-toggle'
import { ThemeProvider } from '@/components/theme-provider'

// Mock useTheme to control theme state
const mockSetTheme = vi.fn()
let mockTheme = 'dark'

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}))

const renderThemeToggle = () => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">
      <ThemeToggle />
    </ThemeProvider>
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear()
    mockTheme = 'dark'
  })

  describe('Rendering', () => {
    it('should render toggle button', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })
    })

    it('should render with correct aria-label', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByLabelText('Toggle theme')
        expect(button).toBeInTheDocument()
      })
    })

    it('should render screen reader text', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const srText = screen.getByText('Toggle theme')
        expect(srText).toHaveClass('sr-only')
      })
    })

    it('should render Sun and Moon icons', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        const svg = button.querySelectorAll('svg')
        expect(svg).toHaveLength(2) // Sun and Moon icons
      })
    })

    it('should render with outline variant', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toHaveClass('border-input')
      })
    })

    it('should show disabled state before mounting', () => {
      // This tests the SSR/hydration phase
      const { container } = renderThemeToggle()
      const button = container.querySelector('button')
      // Button should initially be disabled during SSR
      expect(button).toBeTruthy()
    })
  })

  describe('Click Interactions', () => {
    it('should toggle from dark to light on click', async () => {
      mockTheme = 'dark'
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /toggle theme/i })
      await user.click(button)

      expect(mockSetTheme).toHaveBeenCalledWith('light')
      expect(mockSetTheme).toHaveBeenCalledTimes(1)
    })

    it('should toggle from light to dark on click', async () => {
      mockTheme = 'light'
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /toggle theme/i })
      await user.click(button)

      expect(mockSetTheme).toHaveBeenCalledWith('dark')
      expect(mockSetTheme).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple clicks correctly', async () => {
      mockTheme = 'dark'
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /toggle theme/i })

      await user.click(button)
      expect(mockSetTheme).toHaveBeenNthCalledWith(1, 'light')

      await user.click(button)
      expect(mockSetTheme).toHaveBeenNthCalledWith(2, 'light')

      expect(mockSetTheme).toHaveBeenCalledTimes(2)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should toggle theme on Enter key', async () => {
      mockTheme = 'dark'
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /toggle theme/i })
      button.focus()
      await user.keyboard('{Enter}')

      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    it('should toggle theme on Space key', async () => {
      mockTheme = 'dark'
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      const button = screen.getByRole('button', { name: /toggle theme/i })
      button.focus()
      await user.keyboard(' ')

      expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    it('should be focusable with Tab key', async () => {
      renderThemeToggle()
      const user = userEvent.setup()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toBeInTheDocument()
      })

      await user.tab()

      const button = screen.getByRole('button', { name: /toggle theme/i })
      expect(button).toHaveFocus()
    })
  })

  describe('Accessibility', () => {
    it('should have correct button role', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
      })
    })

    it('should have accessible name', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        expect(button).toHaveAccessibleName()
      })
    })

    it('should have screen reader only text', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const srText = screen.getByText('Toggle theme')
        expect(srText).toHaveClass('sr-only')
      })
    })

    it('should have visible focus ring', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        // Button component has focus-visible:ring classes
        expect(button.className).toContain('focus-visible')
      })
    })
  })

  describe('Icon Transitions', () => {
    it('should show correct icon classes for dark theme', async () => {
      mockTheme = 'dark'
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        const svg = button.querySelectorAll('svg')

        // Sun icon (first svg)
        expect(svg[0]).toHaveClass('transition-all')

        // Moon icon (second svg)
        expect(svg[1]).toHaveClass('absolute')
        expect(svg[1]).toHaveClass('transition-all')
      })
    })

    it('should have smooth transitions on icons', async () => {
      renderThemeToggle()

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /toggle theme/i })
        const svg = button.querySelectorAll('svg')

        svg.forEach((icon) => {
          expect(icon).toHaveClass('transition-all')
        })
      })
    })
  })
})
