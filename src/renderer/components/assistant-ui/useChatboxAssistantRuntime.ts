import { type AppendMessage, type ThreadMessageLike, useExternalStoreRuntime } from '@assistant-ui/react'
import { createMessage, type Message, MessageRoleEnum } from '@shared/types'
import { useCallback, useMemo } from 'react'
import { useSession } from '@/hooks/useSessionStorage'
import { stopAllMessageGenerations } from '@/stores/session/generation-cancellation'
import { submitNewUserMessage } from '@/stores/session/messages'
import { getAllMessageList } from '@/stores/sessionHelpers'

type ThreadMessageLikePart = Exclude<ThreadMessageLike['content'], string>[number]

/**
 * Convert a chatbox session Message into the shape assistant-ui's external
 * store runtime can render. Parts that need async resolution (image storage
 * keys) or are app-internal (agent-mode-suggestion) are dropped for now.
 */
function toThreadMessageLike(message: Message): ThreadMessageLike | null {
  if (message.role !== MessageRoleEnum.User && message.role !== MessageRoleEnum.Assistant) {
    return null
  }

  const content: ThreadMessageLikePart[] = []
  for (const part of message.contentParts ?? []) {
    switch (part.type) {
      case 'text': {
        if (part.protocolOnly || !part.text.trim()) break
        content.push({ type: 'text', text: part.text })
        break
      }
      case 'info': {
        if (!part.text.trim()) break
        content.push({ type: 'text', text: part.text })
        break
      }
      case 'reasoning': {
        if (part.protocolOnly || !part.text.trim()) break
        content.push({ type: 'reasoning', text: part.text })
        break
      }
      case 'tool-call': {
        // Tool args are stored as arbitrary provider JSON; assistant-ui wants a
        // plain JSON object, so round-trip through JSON to guarantee the shape.
        const args = JSON.parse(JSON.stringify(part.args ?? {}))
        content.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args,
          argsText: JSON.stringify(args, null, 2),
          // assistant-ui derives running/complete from result presence.
          ...(part.result !== undefined ? { result: part.result } : {}),
          ...(part.state === 'error' ? { isError: true } : {}),
        })
        break
      }
      default:
        break
    }
  }

  if (content.length === 0) return null

  return {
    role: message.role === MessageRoleEnum.User ? 'user' : 'assistant',
    id: message.id,
    content,
  }
}

/**
 * Bridge the chatbox session store onto an assistant-ui external store
 * runtime, so the vendored assistant-ui thread components can render real
 * sessions. Reading is fully reactive (useSession invalidates on session
 * updates); sending reuses the normal submit path (queueing, gates, locks)
 * and cancelling reuses the shared generation cancellation.
 */
export function useChatboxAssistantRuntime(sessionId: string | undefined) {
  const { data: session } = useSession(sessionId)

  const rawMessages = useMemo(() => (session ? getAllMessageList(session) : []), [session])

  const messages = useMemo(() => {
    return rawMessages.map(toThreadMessageLike).filter((m): m is ThreadMessageLike => m !== null)
  }, [rawMessages])

  /** The shared store marks the streaming reply on the last message. */
  const isRunning = rawMessages.at(-1)?.generating === true

  const onNew = useCallback(
    async (message: AppendMessage) => {
      if (!sessionId) return
      const text = message.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n')
        .trim()
      if (!text) return
      await submitNewUserMessage(sessionId, {
        newUserMsg: createMessage(MessageRoleEnum.User, text),
        needGenerating: true,
      })
    },
    [sessionId]
  )

  const onCancel = useCallback(async () => {
    if (!sessionId) return
    await stopAllMessageGenerations(sessionId)
  }, [sessionId])

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage: (message) => message,
    isDisabled: !sessionId,
    onNew,
    onCancel,
  })

  return { runtime, hasSession: Boolean(session) }
}
