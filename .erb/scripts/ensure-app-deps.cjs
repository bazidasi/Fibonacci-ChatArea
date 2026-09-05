/**
 * beforePack hook for electron-builder.
 *
 * With bun's hoisted linker, dependencies declared in
 * release/app/package.json get hoisted to the workspace root
 * node_modules/ instead of release/app/node_modules/.
 * electron-builder only packages release/app/node_modules/,
 * so transitive deps like detect-libc, node-fetch, zod end up
 * missing from the asar.
 *
 * This script runs `npm ci --omit=dev` in release/app/
 * to create a complete, flat node_modules/ before packaging,
 * then removes dev-only artifacts that shouldn't ship.
 */
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { verifyInstalledRuntimeDeps } = require('./runtime-deps.cjs')

exports.default = async function ensureAppDeps(context) {
  const appDir = path.join(__dirname, '..', '..', 'release', 'app')
  const nodeModulesDir = path.join(appDir, 'node_modules')

  // Remove any stale hoisted node_modules if it exists
  if (fs.existsSync(nodeModulesDir)) {
    fs.rmSync(nodeModulesDir, { recursive: true, force: true })
  }

  console.log('[ensure-app-deps] Installing production dependencies in release/app/ ...')
  execSync('npm ci --omit=dev --ignore-scripts', {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_registry: 'https://registry.npmmirror.com' },
  })

  verifyInstalledRuntimeDeps(appDir)
  verifyVersionsMatchBunWorkspace(appDir)

  // Remove type-only packages that are not needed at runtime.
  // @anthropic-ai/sandbox-runtime incorrectly lists @types/lodash-es
  // in production dependencies, pulling in @types/* and undici-types.
  const packagesToRemove = ['@types', 'undici-types']
  for (const pkg of packagesToRemove) {
    const pkgPath = path.join(nodeModulesDir, pkg)
    if (fs.existsSync(pkgPath)) {
      fs.rmSync(pkgPath, { recursive: true, force: true })
      console.log(`[ensure-app-deps] Removed dev-only package: ${pkg}`)
    }
  }

  console.log('[ensure-app-deps] Done.')
}

/**
 * Guard against version skew between release/app/package-lock.json (used by
 * `npm ci` to materialize node_modules) and the root bun.lock (used by
 * electron-builder's bun node-module collector).
 *
 * electron-builder detects this repo as a bun workspace and resolves the
 * packaged dependency tree via bun.lock, while the physical node_modules is
 * created by npm. If the two lockfiles resolve a package to different versions,
 * the collector cannot find the expected version on disk and silently drops the
 * package from the asar — e.g. ws@8.20.0 on disk vs ws@8.19.0 expected caused
 * `Cannot find module 'ws'` at app startup. Keep the versions aligned (e.g.
 * via "overrides" in release/app/package.json mirrored in the root
 * package.json); this check makes any future skew fail the build loudly
 * instead of shipping a broken app.
 *
 * The bun.lock tree is read from disk rather than from release/app/node_modules
 * because this hook runs after `npm ci` has replaced that directory, so it no
 * longer reflects bun's resolution.
 *
 * Type-only packages (@types/*, undici-types) are excluded: they are removed
 * from disk before packaging and never needed at runtime.
 */

// bun.lock is JSONC: it may contain `//` comment lines and trailing commas.
// Only whole-line `//` comments are stripped — `//` inside string values
// (e.g. base64 integrity hashes) must survive.
function stripJsoncComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

function parseBunLock(text) {
  return JSON.parse(stripJsoncComments(text).replace(/,(\s*[}\]])/g, '$1'))
}

/**
 * bun.lock keys package entries by install path: "name" for the hoisted copy
 * and "parent/name" (deeper chains possible) for a version nested under a
 * dependent, e.g. "@a2a-js/sdk/uuid". Entries are arrays:
 * [resolvedSpec, integrity, metadata] where resolvedSpec looks like
 * "uuid@11.1.1" (or "pkg@workspace:..." for workspace members).
 */
function entryVersion(entry) {
  const spec = Array.isArray(entry) ? entry[0] : undefined
  if (typeof spec !== 'string') return undefined
  const at = spec.lastIndexOf('@')
  return at > 0 ? spec.slice(at + 1) : spec
}

function entryMeta(entry) {
  return Array.isArray(entry) ? entry[2] : undefined
}

function isWorkspaceEntry(entry) {
  const spec = Array.isArray(entry) ? entry[0] : ''
  return typeof spec === 'string' && spec.includes('workspace:')
}

function locatePackage(packages, parentPath, name) {
  if (parentPath) {
    const nested = packages[`${parentPath}/${name}`]
    if (nested) return { entry: nested, installPath: `${parentPath}/${name}` }
  }
  const hoisted = packages[name]
  if (hoisted) return { entry: hoisted, installPath: name }
  return undefined
}

/**
 * Build a pnpm-list-shaped tree ({ dependencies: { name: { version, dependencies } } })
 * for the given workspace's production dependencies out of a parsed bun.lock.
 * Walkable by the same code that used to walk `pnpm list --json` output.
 */
function buildProductionDependencyTreeFromBunLock(bunLock, workspaceKey = 'release/app') {
  const packages = bunLock.packages ?? {}
  const workspaceEntry = bunLock.workspaces?.[workspaceKey]
  if (!workspaceEntry) {
    throw new Error(
      `workspace "${workspaceKey}" not found in bun.lock (workspaces: ${Object.keys(bunLock.workspaces ?? {}).join(', ')})`,
    )
  }

  const root = { dependencies: {} }
  const seen = new Set()
  const visit = (name, parentPath, node) => {
    const located = locatePackage(packages, parentPath, name)
    if (!located || isWorkspaceEntry(located.entry)) return
    const version = entryVersion(located.entry)
    if (!version) return
    node.dependencies[name] = { version, dependencies: {} }
    if (seen.has(located.installPath)) return
    seen.add(located.installPath)
    const meta = entryMeta(located.entry) || {}
    const childNames = Object.keys({
      ...(meta.dependencies || {}),
      ...(meta.optionalDependencies || {}),
    })
    for (const childName of childNames) {
      visit(childName, located.installPath, node.dependencies[name])
    }
  }
  for (const name of Object.keys(workspaceEntry.dependencies || {})) {
    visit(name, '', root)
  }
  for (const name of Object.keys(workspaceEntry.optionalDependencies || {})) {
    visit(name, '', root)
  }
  return root
}

function readBunWorkspaceProductionDependencyTree(appDir) {
  const bunLockPath = path.join(appDir, '..', '..', 'bun.lock')
  const bunLock = parseBunLock(fs.readFileSync(bunLockPath, 'utf8'))
  return JSON.stringify(buildProductionDependencyTreeFromBunLock(bunLock, 'release/app'))
}

function verifyVersionsMatchBunWorkspace(appDir, options = {}) {
  const readTree = options.readBunTree || readBunWorkspaceProductionDependencyTree
  let bunTree
  try {
    const output = readTree(appDir)
    bunTree = JSON.parse(output)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `[ensure-app-deps] failed to verify versions against bun workspace lockfile: ${message}`,
    )
  }

  const bunVersions = new Map()
  const walk = (node) => {
    for (const [depName, dep] of Object.entries(node?.dependencies || {})) {
      if (dep && dep.version) {
        bunVersions.set(depName, dep.version)
      }
      walk(dep)
    }
  }
  walk(bunTree)

  if (bunVersions.size === 0) {
    // Fail closed: an empty tree means the check saw nothing to compare, which
    // would silently report every skew as verified. Better to fail the build
    // than to ship a package with missing runtime dependencies again.
    throw new Error(
      '[ensure-app-deps] bun.lock returned no production dependencies — cannot verify version alignment with the bun workspace lockfile. ' +
        'Run `bun install` at the repo root to (re)generate bun.lock and debug.',
    )
  }

  const npmLock = JSON.parse(fs.readFileSync(path.join(appDir, 'package-lock.json'), 'utf8'))
  const mismatches = []
  for (const [name, bunVersion] of bunVersions) {
    if (name.startsWith('@types/') || name === 'undici-types') {
      continue
    }
    const npmKey = Object.keys(npmLock.packages).find((key) => {
      return key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)
    })
    const npmVersion = npmKey != null ? npmLock.packages[npmKey].version : undefined
    if (npmVersion !== bunVersion) {
      mismatches.push(`  ${name}: npm lock ${npmVersion ?? '(missing)'} != bun lock ${bunVersion}`)
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `[ensure-app-deps] version skew between release/app/package-lock.json and the bun workspace lockfile:\n${mismatches.join('\n')}\n` +
        'Align the versions (e.g. via "overrides" in release/app/package.json mirrored in the root package.json), otherwise the packaged app will silently miss runtime dependencies.',
    )
  }

  console.log('[ensure-app-deps] verified dependency versions match bun workspace lockfile')
}

exports.buildProductionDependencyTreeFromBunLock = buildProductionDependencyTreeFromBunLock
exports.parseBunLock = parseBunLock
exports.verifyVersionsMatchBunWorkspace = verifyVersionsMatchBunWorkspace
