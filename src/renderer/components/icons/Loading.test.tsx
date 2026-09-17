import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Loading from './Loading'

const settings = vi.hoisted(() => ({ theme: 'light' }))
vi.mock('@mantine/core', () => ({ useComputedColorScheme: () => settings.theme }))
vi.mock('thinking-orbs', () => ({
  ThinkingOrb: ({ state, size, theme, paused, ...rest }: any) => (
    <canvas data-state={state} data-size={size} data-theme={theme} data-paused={paused} {...rest} />
  ),
}))

describe('Loading orb', () => {
  it.each(['light', 'dark'])('uses app %s theme at avatar scale', (theme) => {
    settings.theme = theme
    const html = renderToStaticMarkup(<Loading aria-label="Thinking" />)
    expect(html).toContain(`data-theme="${theme}"`)
    expect(html).toContain('data-size="64"')
    expect(html).toContain('aria-label="Thinking"')
  })

  it('preserves inline state, theme and pause overrides', () => {
    const html = renderToStaticMarkup(<Loading state="connecting" size={20} theme="light" paused />)
    expect(html).toContain('data-state="connecting"')
    expect(html).toContain('data-size="20"')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('data-paused="true"')
  })
})
