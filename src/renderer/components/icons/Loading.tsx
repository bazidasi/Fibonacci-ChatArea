import { useComputedColorScheme } from '@mantine/core'
import { type ComponentProps, memo } from 'react'
import { ThinkingOrb } from 'thinking-orbs'

function Loading(props: ComponentProps<typeof ThinkingOrb>) {
  const theme = useComputedColorScheme('light')
  return <ThinkingOrb state="searching" size={64} theme={theme} {...props} />
}

export default memo(Loading)
