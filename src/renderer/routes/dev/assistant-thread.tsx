import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { Box, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { Thread } from '@/components/assistant-ui/elements/thread.aui'
import { useChatboxAssistantRuntime } from '@/components/assistant-ui/useChatboxAssistantRuntime'
import { currentSessionIdAtom } from '@/stores/atoms'

export const Route = createFileRoute('/dev/assistant-thread')({
  component: AssistantThreadPreview,
})

/**
 * Preview surface for the assistant-ui thread components backed by the real
 * chatbox session store. Safe to experiment with: it renders alongside the
 * production MessageList and only reuses the existing send/cancel actions.
 */
function AssistantThreadPreview() {
  const sessionId = useAtomValue(currentSessionIdAtom)
  const { runtime, hasSession } = useChatboxAssistantRuntime(sessionId ?? undefined)

  if (!hasSession) {
    return (
      <Box p="xl">
        <Text c="dimmed">Open a chat session first, then come back to this page.</Text>
      </Box>
    )
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Stack h="100vh" p="md" gap="xs">
        <Title order={4} c="dimmed">
          assistant-ui thread preview (current session, read-write)
        </Title>
        <Box style={{ flex: 1, minHeight: 0 }}>
          <Thread />
        </Box>
      </Stack>
    </AssistantRuntimeProvider>
  )
}
