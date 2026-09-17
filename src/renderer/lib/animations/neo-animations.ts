/**
 * Fibonacci Chat Area — animation core.
 *
 * Brings together the three animation libraries used across the app:
 *  - GSAP  (https://gsap.com)                 → splash intro, staggered entrances
 *  - Lenis (https://lenis.darkroom.engineering) → buttery smooth scrolling
 *  - Motion (https://motion.dev)              → React micro-interactions (see NeoMotion.tsx)
 *
 * Everything respects `prefers-reduced-motion`.
 */
import { gsap } from 'gsap'
import Lenis from 'lenis'

export { gsap }

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Splash intro: draws the fibonacci spiral stroke by stroke (GSAP), then eases
 * the orbital rings in. Runs against the static DOM in index.html before React mounts.
 */
export function runSplashIntro(): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  const path = document.querySelector<SVGPathElement>('.splash-screen-logo path')
  if (path) {
    const length = path.getTotalLength()
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length, opacity: 1 })
    gsap.to(path, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
  }
  const rings = document.querySelector('.splash-screen-logo-bg')
  if (rings) {
    gsap.fromTo(
      rings,
      { scale: 0.82, opacity: 0, transformOrigin: '50% 50%' },
      { scale: 1, opacity: 1, duration: 1.9, ease: 'power2.out' }
    )
  }
}

/**
 * Attach a Lenis smooth-scroll controller to an arbitrary scroll container
 * (the chat message list uses react-virtuoso's scroller). Lenis intercepts
 * wheel input, animates scrollTop and stays in sync with programmatic
 * scrolls performed by Virtuoso (scrollToIndex / follow / restore) through
 * its native scroll listener.
 *
 * Returns a cleanup function, or null when smooth scroll is unavailable.
 */
export function attachLenisScroller(el: HTMLElement): (() => void) | null {
  if (prefersReducedMotion()) return null
  // never double-attach (Virtuoso can invoke scrollerRef more than once)
  if (el.dataset.lenisSmooth === 'on') return null

  const content = el.firstElementChild instanceof HTMLElement ? el.firstElementChild : undefined
  let lenis: Lenis
  try {
    lenis = new Lenis({
      wrapper: el,
      content,
      duration: 0.85,
      smoothWheel: true,
      // keep touch scrolling native — virtualized lists + mobile webviews behave better
      syncTouch: false,
      // let nested scrollables (code blocks, formulas, textareas) scroll natively
      prevent: (node) =>
        Boolean(
          node.closest?.('pre, code, textarea, input, select, .katex-display, [data-lenis-prevent]')
        ),
    })
  } catch {
    return null
  }

  el.dataset.lenisSmooth = 'on'
  let rafId = 0
  const loop = (time: number) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(rafId)
    try {
      lenis.destroy()
    } catch {
      // already destroyed
    }
    delete el.dataset.lenisSmooth
  }
}

/**
 * Staggered GSAP entrance for sidebar regions marked with `[data-neo-anim]`.
 * Returns a cleanup that restores the initial styles.
 */
export function animateSidebarEntrance(root: HTMLElement | null): (() => void) | null {
  if (!root || prefersReducedMotion()) return null
  const targets = root.querySelectorAll<HTMLElement>('[data-neo-anim]')
  if (!targets.length) return null
  const ctx = gsap.context(() => {
    gsap.fromTo(
      targets,
      { opacity: 0, y: -12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.07,
        ease: 'power3.out',
        delay: 0.12,
        overwrite: 'auto',
      }
    )
  })
  return () => ctx.revert()
}
