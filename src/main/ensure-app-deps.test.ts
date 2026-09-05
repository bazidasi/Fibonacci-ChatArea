import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

interface EnsureAppDepsModule {
  verifyVersionsMatchBunWorkspace: (appDir: string, options?: { readBunTree?: (appDir: string) => string }) => void
  buildProductionDependencyTreeFromBunLock: (
    bunLock: unknown,
    workspaceKey?: string,
  ) => { dependencies: Record<string, { version: string; dependencies: Record<string, unknown> }> }
}

const require = createRequire(import.meta.url)
const {
  verifyVersionsMatchBunWorkspace,
  buildProductionDependencyTreeFromBunLock,
} = require('../../.erb/scripts/ensure-app-deps.cjs') as EnsureAppDepsModule

describe('ensure-app-deps version guard', () => {
  test('fails closed when bun.lock dependency collection fails', () => {
    expect(() =>
      verifyVersionsMatchBunWorkspace('/unused', {
        readBunTree: () => {
          throw new Error('bun.lock read failed')
        },
      })
    ).toThrow('[ensure-app-deps] failed to verify versions against bun workspace lockfile: bun.lock read failed')
  })

  test('fails closed when the lockfile tree is invalid JSON', () => {
    expect(() =>
      verifyVersionsMatchBunWorkspace('/unused', {
        readBunTree: () => '{invalid',
      })
    ).toThrow('[ensure-app-deps] failed to verify versions against bun workspace lockfile:')
  })
})

describe('buildProductionDependencyTreeFromBunLock', () => {
  // Mirrors bun 1.4's bun.lock shape: packages are keyed by install path
  // ("name" for the hoisted copy, "parent/name" for a nested copy) and each
  // entry is [resolvedSpec, integrity, metadata].
  const bunLock = {
    lockfileVersion: 1,
    workspaces: {
      '': { name: 'app.fibonacci.chat-area' },
      'release/app': {
        name: 'app.fibonacci.chat-area',
        dependencies: {
          '@libsql/client': '^0.15.6',
          'sandbox-runtime': '^0.0.54',
        },
      },
    },
    packages: {
      '@libsql/client': ['@libsql/client@0.15.6', '', { dependencies: { libsql: '^0.5.0' } }, 'sha512-a'],
      // A nested (non-hoisted) copy must win over the hoisted one when
      // resolving from its dependent's install path.
      libsql: ['libsql@0.5.22', '', {}, 'sha512-b'],
      '@libsql/client/libsql': ['libsql@0.5.30', '', {}, 'sha512-c'],
      'sandbox-runtime': ['sandbox-runtime@0.0.54', '', { dependencies: { ws: '^8.18.0' } }, 'sha512-d'],
      ws: ['ws@8.19.0', '', {}, 'sha512-e'],
    },
  }

  test('walks production dependencies through transitive and nested-path entries', () => {
    const tree = buildProductionDependencyTreeFromBunLock(bunLock, 'release/app')
    expect(tree.dependencies['@libsql/client']).toMatchObject({ version: '0.15.6' })
    expect(tree.dependencies['sandbox-runtime']).toMatchObject({ version: '0.0.54' })
    expect(tree.dependencies['@libsql/client'].dependencies.libsql).toMatchObject({ version: '0.5.30' })
    expect(tree.dependencies['sandbox-runtime'].dependencies.ws).toMatchObject({ version: '8.19.0' })
  })

  test('skips workspace-protocol members', () => {
    const lock = {
      workspaces: {
        'release/app': { dependencies: { '@chatbox/core': 'workspace:*' } },
      },
      packages: {
        '@chatbox/core': ['@chatbox/core@workspace:packages/chatbox-core', '', {}, ''],
      },
    }
    const tree = buildProductionDependencyTreeFromBunLock(lock, 'release/app')
    expect(tree.dependencies).toEqual({})
  })

  test('throws when the workspace is missing (fail closed)', () => {
    expect(() => buildProductionDependencyTreeFromBunLock({ workspaces: {} }, 'release/app')).toThrow(
      'workspace "release/app" not found in bun.lock',
    )
  })
})
