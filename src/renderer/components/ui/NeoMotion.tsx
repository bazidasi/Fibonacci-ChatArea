/**
 * Fibonacci Chat Area — Motion (motion.dev) micro-interaction primitives.
 *
 * Soft-UI friendly springs used for presses, entrances and hover lifts.
 * All primitives respect the user's reduced-motion preference.
 */
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'

/** The app-wide soft spring used by Motion interactions. */
export const neoSpring = { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 } as const

interface NeoPressableProps extends HTMLMotionProps<'div'> {
  children?: ReactNode
}

/**
 * A soft-UI pressable wrapper: lifts slightly on hover, compresses like an
 * extruded neumorphic element when tapped. Wrap Mantine buttons/cards with it.
 */
export function NeoPressable({ children, ...rest }: NeoPressableProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={neoSpring}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

interface NeoRiseProps {
  children?: ReactNode
  delay?: number
  className?: string
}

/** Soft entrance: rises into place with a gentle spring. */
export function NeoRise({ children, delay = 0, className }: NeoRiseProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...neoSpring, delay }}
    >
      {children}
    </motion.div>
  )
}
