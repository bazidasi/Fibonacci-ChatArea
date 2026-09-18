import { settingsStore } from '@/stores/settingsStore'
import { getHardwareCapabilities, type HardwareCapabilities } from '@/lib/hardware-capabilities'

/**
 * Applies the `data-reduce-motion` attribute to `<html>` based on
 * settings and hardware capability, and keeps it in sync when
 * either changes.
 *
 * Called once during renderer bootstrap. Sets up a subscription
 * to the settings store so the attribute updates when the user
 * toggles the preference.
 */
export function bootstrapReduceMotion(): void {
  if (typeof document === 'undefined') return
  apply()
  // Re-apply on every settings change. Hardware capabilities are
  // cached at module level and do not change at runtime.
  settingsStore.subscribe(apply)
}

let _lastReduce = false as boolean | undefined

function apply(): void {
  const root = document.documentElement
  const userPref = settingsStore.getState().prefersReducedMotion
  const hardware = typeof reduceMotionHw === 'undefined' ? detect() : reduceMotionHw
  const reduce = userPref === true || hardware.isLowEnd
  if (reduce === _lastReduce) return
  _lastReduce = reduce
  if (reduce) {
    root.setAttribute('data-reduce-motion', '')
  } else {
    root.removeAttribute('data-reduce-motion')
  }
}

let reduceMotionHw: HardwareCapabilities | undefined

function detect(): HardwareCapabilities {
  if (reduceMotionHw) return reduceMotionHw
  reduceMotionHw = getHardwareCapabilities()
  return reduceMotionHw
}
