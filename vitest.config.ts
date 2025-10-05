// ABOUTME: Vitest configuration for domain layer testing with hexagonal architecture
// ABOUTME: Enforces 95%+ coverage thresholds and configures test environment

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use Node.js environment for pure domain logic tests
    environment: 'node',

    // Enable global test APIs (describe, it, expect) without imports
    globals: true,

    // Run tests in parallel for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Test file patterns
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next', 'coverage'],

    // Clear mocks automatically between tests
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,

    // Test timeout
    testTimeout: 5000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Include only domain layer files
      include: [
        'src/domain/**/*.ts',
      ],

      // Exclude test files and helpers
      exclude: [
        '**/__tests__/**',
        '**/__test-helpers__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'src/domain/repositories/**', // Interfaces only
      ],

      // Enforce high coverage thresholds for domain layer
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },

      // Report uncovered lines
      all: true,
      reportOnFailure: true,
    },
  },

  // Path resolution matching tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
    },
  },
});
