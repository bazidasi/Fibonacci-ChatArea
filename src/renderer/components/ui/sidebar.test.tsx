// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SidebarProvider, useSidebar } from './sidebar'

const MOBILE_WIDTH = 480

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  })
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: MOBILE_WIDTH,
  })
})

function MobileStateProbe() {
  const { openMobile, setOpenMobile } = useSidebar()
  return (
    <button type="button" onClick={() => setOpenMobile(!openMobile)}>
      {openMobile ? 'open' : 'closed'}
    </button>
  )
}

function ControlledMobileProbe({ initialOpen = false }) {
  const [open, setOpen] = React.useState(initialOpen)
  const onOpenChange = React.useCallback((value: boolean) => setOpen(value), [])
  return (
    <SidebarProvider open={open} onOpenChange={onOpenChange}>
      <MobileStateProbe />
    </SidebarProvider>
  )
}

describe('sidebar provider mobile state', () => {
  test('mobile sheet open state mirrors the controlled provider open prop', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <MobileStateProbe />
      </SidebarProvider>
    )

    expect(screen.getByRole('button').textContent).toBe('closed')

    rerender(
      <SidebarProvider open onOpenChange={onOpenChange}>
        <MobileStateProbe />
      </SidebarProvider>
    )

    expect(screen.getByRole('button').textContent).toBe('open')
  })

  test('mobile sheet toggles write through the controlled onOpenChange', () => {
    render(<ControlledMobileProbe />)

    expect(screen.getByRole('button').textContent).toBe('closed')

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button').textContent).toBe('open')
  })
})
