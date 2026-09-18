import { useSettingsStore } from '@/stores/settingsStore'
import { getHardwareCapabilities } from '@/lib/hardware-capabilities'

/**
 * Returns true when motion should be reduced.
 *
 * Combines the user's explicit `prefersReducedMotion` setting with
 * auto-detection of low-end hardware (navigator.hardwareConcurrency
 * and navigator.deviceMemory). Either condition triggers reduced motion.
 * Hardware capabilities are cached at module level since they do not
 * change at runtime.
 */
export function useReduceMotion(): boolean {
  const userPref = useSettingsStore((s) => s.prefersReducedMotion)
  if (typeof useReduceMotion._hw === 'undefined') {
    useReduceMotion._hw = getHardwareCapabilities()
  }
  return userPref === true || useReduceMotion._hw!.isLowEnd
}

useReduceMotion._hw = undefined as unknown as { isLowEnd: boolean; reason: string } | undefined
