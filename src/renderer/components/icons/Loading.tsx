import type { SVGProps, ComponentProps } from 'react'
import { memo } from 'react'
import { ThinkingOrb } from 'thinking-orbs'

function Loading(props: SVGProps<SVGSVGElement>) {
  return (
    <ThinkingOrb
      state="searching"
      size={64}
      {...(props as ComponentProps<typeof ThinkingOrb>)}
    />
  )
}

export default memo(Loading)
