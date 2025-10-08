// ABOUTME: Singleton initialization helper for DependencyContainer to prevent re-initialization on every request
// ABOUTME: Uses globalThis to survive Next.js HMR and ensure MongoDB connections are reused across requests

import { DependencyContainer } from './DependencyContainer';

// Use globalThis to survive Next.js hot module reloading
const globalForContainer = globalThis as unknown as {
  containerInstance: DependencyContainer | null;
  initializationPromise: Promise<DependencyContainer> | null;
};

/**
 * Gets or creates the singleton DependencyContainer instance.
 * Safe for concurrent calls - will only initialize once.
 * Uses globalThis to survive Next.js HMR in development.
 */
export async function getContainer(): Promise<DependencyContainer> {
  // If already initialized, return immediately
  if (globalForContainer.containerInstance) {
    return globalForContainer.containerInstance;
  }

  // If initialization is in progress, wait for it
  if (globalForContainer.initializationPromise) {
    return globalForContainer.initializationPromise;
  }

  // Start initialization
  console.log('[Container] Initializing DependencyContainer singleton...');
  globalForContainer.initializationPromise = DependencyContainer.create({
    enableLogging: process.env.NODE_ENV === 'development',
  });

  try {
    globalForContainer.containerInstance = await globalForContainer.initializationPromise;
    console.log('[Container] DependencyContainer initialized successfully');
    return globalForContainer.containerInstance;
  } catch (error) {
    // Reset on failure so next call will retry
    globalForContainer.initializationPromise = null;
    console.error('[Container] Failed to initialize DependencyContainer:', error);
    throw error;
  }
}

/**
 * Resets the container (useful for testing or config changes)
 */
export function resetContainer(): void {
  globalForContainer.containerInstance = null;
  globalForContainer.initializationPromise = null;
  DependencyContainer.reset();
  console.log('[Container] DependencyContainer reset');
}
