import { QueryClient } from '@tanstack/react-query'

/**
 * Creates a host-owned QueryClient.
 *
 * Shared bindings deliberately expose a factory rather than a singleton so
 * Electron, Web, Capacitor, and React Native can each provide their own cache.
 */
export function createChatQueryClient(): QueryClient {
  const queryClient = new QueryClient()
  // Session updates are immutable and already preserve unchanged branches.
  // structuralSharing:true (default) lets replaceEqualDeep skip unchanged
  // subtrees via Object.is — eliminating per-chunk React re-renders for
  // unchanged messages.
  return queryClient
}
