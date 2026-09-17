'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

import { Slot, type WithAsChild } from '@/components/animate-ui/primitives/animate/slot';

type ButtonProps = WithAsChild<
  HTMLMotionProps<'button'> & {
    hoverScale?: number;
    tapScale?: number;
  }
>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { hoverScale = 1.05, tapScale = 0.95, asChild = false, ...props },
  ref,
) {
  // cast through ElementType: the Slot | motion.button union confuses JSX
  // prop checking under strict mode, but the runtime contract is identical.
  const Component = (asChild ? Slot : motion.button) as React.ElementType;

  return (
    <Component
      ref={ref}
      whileTap={{ scale: tapScale }}
      whileHover={{ scale: hoverScale }}
      {...props}
    />
  );
});

export { Button, type ButtonProps };
