// ABOUTME: Unit tests for ThemeToggle component
// ABOUTME: Tests theme switching, accessibility, persistence, and edge cases

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';

// Mock next-themes
const mockSetTheme = vi.fn();
const mockTheme = vi.fn(() => 'light');

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme(),
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeToggle Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    mockSetTheme.mockClear();
    mockTheme.mockReturnValue('light');
  });

  describe('Core Scenario 1: Rendering', () => {
    it('should render theme toggle button', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-label');
      expect(button.getAttribute('aria-label')).toMatch(/switch to (dark|light) mode/i);
    });

    it('should be keyboard focusable', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      button.focus();
      expect(button).toHaveFocus();
    });
  });

  describe('Core Scenario 2: Toggle Functionality', () => {
    it('should toggle from light to dark theme on click', async () => {
      mockTheme.mockReturnValue('light');
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should toggle from dark to light theme on click', async () => {
      mockTheme.mockReturnValue('dark');
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should call setTheme function when button is clicked', async () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      await user.click(button);

      expect(mockSetTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('Core Scenario 3: Keyboard Navigation', () => {
    it('should toggle theme on Enter key', async () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should toggle theme on Space key', async () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard(' ');

      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should maintain focus after toggle', async () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      await user.click(button);

      expect(button).toHaveFocus();
    });
  });

  describe('Core Scenario 4: Accessibility', () => {
    it('should update aria-label based on current theme', () => {
      mockTheme.mockReturnValue('light');
      const { rerender } = render(<ThemeToggle />);
      const button = screen.getByRole('button');

      expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');

      mockTheme.mockReturnValue('dark');
      rerender(<ThemeToggle />);

      expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    });

    it('should render both Sun and Moon icons', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Both icons should be in the DOM (one visible via CSS)
      const svgElements = button.querySelectorAll('svg');
      expect(svgElements.length).toBe(2);
    });
  });

  describe('Core Scenario 5: Edge Cases', () => {
    it('should handle rapid successive toggles', async () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should have called setTheme 3 times
      expect(mockSetTheme).toHaveBeenCalledTimes(3);
    });

    it('should handle system theme preference', () => {
      mockTheme.mockReturnValue('system');
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Should not throw error with system theme
      expect(button).toBeInTheDocument();
    });

    it('should handle undefined theme gracefully', () => {
      mockTheme.mockReturnValue(undefined);

      // Should render without errors
      expect(() => render(<ThemeToggle />)).not.toThrow();
    });
  });

  describe('Integration: Component Behavior', () => {
    it('should render ghost variant button', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Check for ghost variant class (from shadcn/ui button)
      expect(button.className).toMatch(/ghost/);
    });

    it('should have responsive sizing classes', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');

      // Check for responsive classes
      expect(button.className).toMatch(/h-8 w-8/);
      expect(button.className).toMatch(/md:h-10 md:w-10/);
    });

    it('should apply icon size classes correctly', () => {
      render(<ThemeToggle />);
      const button = screen.getByRole('button');
      const icons = button.querySelectorAll('svg');

      icons.forEach((icon) => {
        expect(icon.className).toMatch(/h-\[1\.2rem\] w-\[1\.2rem\]/);
      });
    });
  });
});
