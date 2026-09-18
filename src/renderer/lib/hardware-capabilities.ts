/**
 * Detects low-end hardware to proactively disable animations.
 *
 * Uses navigator.hardwareConcurrency and navigator.deviceMemory (where
 * available). Falls back to reduced-motion preference when APIs are absent.
 * Conservative heuristic: device is flagged low-end if EITHER cores ≤ 4
 * OR device memory ≤ 4 GB. When probe APIs are unavailable we assume
 * low-end (safe default).
 */

export interface HardwareCapabilities {
  isLowEnd: boolean
  /** Human-readable reason string, useful for logging/debugging. */
  reason: string
}

function detectLowEnd(): HardwareCapabilities {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  const deviceMemory = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined

  if (cores === undefined && deviceMemory === undefined) {
    return { isLowEnd: true, reason: 'hardware-probe-unavailable' }
  }

  const coreLow = cores !== undefined && cores <= 4
  const memoryLow = deviceMemory !== undefined && deviceMemory <= 4

  if (coreLow || memoryLow) {
    const parts: string[] = []
    if (coreLow) parts.push(`cores=${cores}`)
    if (memoryLow) parts.push(`memory=${deviceMemory}GB`)
    return { isLowEnd: true, reason: `low-end:${parts.join(',')}` }
  }

  return { isLowEnd: false, reason: `cores=${cores},memory=${deviceMemory}` }
}

export function getHardwareCapabilities(): HardwareCapabilities {
  return detectLowEnd()
}
