const sessionGenerationTails = new Map<string, Promise<void>>()

/**
 * Serializes message submission and background follow-up generation per session.
 * The queued tail is independent from the task result, so a failed generation
 * cannot poison later submissions.
 */
export async function withSessionGenerationLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const previous = sessionGenerationTails.get(sessionId) ?? Promise.resolve()
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  sessionGenerationTails.set(sessionId, tail)

  await previous
  try {
    return await task()
  } finally {
    release()
    if (sessionGenerationTails.get(sessionId) === tail) {
      sessionGenerationTails.delete(sessionId)
    }
  }
}

export function resetSessionGenerationLocksForTests(): void {
  sessionGenerationTails.clear()
}

/**
 * Remove orphaned lock entries for a session that has ended.
 * Called by session lifecycle management (e.g. SessionService on session deletion).
 */
export function releaseSessionGenerationLock(sessionId: string): void {
  sessionGenerationTails.delete(sessionId)
}
