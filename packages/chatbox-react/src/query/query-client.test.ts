import { describe } from 'vitest'
import { createChatQueryClient } from './query-client'
import { QueryKeys } from './query-keys'

describe('createChatQueryClient', () => {
  test('uses default structural sharing (tanstack-query default: true)', () => {
    const queryClient = createChatQueryClient()
    // No structuralSharing override means tanstack-query default (true) applies.
    // This is intentional: session updates use immutable patterns, so
    // replaceEqualDeep can skip unchanged subtrees via Object.is.
    expect(queryClient.getQueryDefaults(QueryKeys.ChatSession('s')).structuralSharing).toBeUndefined()
    expect(queryClient.getQueryDefaults(QueryKeys.ChatSessionsList).structuralSharing).toBeUndefined()
    expect(queryClient.getQueryDefaults(QueryKeys.ChatSessionSettings('s')).structuralSharing).toBeUndefined()
  })
})
