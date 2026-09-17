# Build Fixes — Fibonacci Chat Area (master branch)

This archive contains your project with all build-blocking issues fixed.
Run `bun install` and then `bun run package` — it now works end-to-end.

## What was broken and what changed

### 1. `EBUSY: resource busy or locked` in clean.js (your reported crash)
**File:** `.erb/scripts/clean.js`

The first step of `bun run package` deletes the previous `release/build` output.
On Windows, `resources/app.asar` inside `win-unpacked` was locked (running packaged
app, Windows Defender scan, or an open Explorer window), so `rimraf` gave up with
EBUSY and the whole script died.

Fix:
- The script now best-effort terminates a running `Fibonacci Chat Area.exe`
  (the unpacked build) before cleaning — this is the most common lock holder.
- `rimraf` now retries for up to ~45s with backoff to ride out antivirus scans.
- If a folder still cannot be deleted you get a clear, actionable message
  instead of a raw stack trace.

### 2. Renderer build crash: "JavaScript heap out of memory"
**File:** `package.json` (`build:main`, `build:renderer`, `build:web`)

The renderer bundles ~17,400 modules. With Node's default heap limit the build
dies with `Ineffective mark-compacts near heap limit` (usually during
"rendering chunks..."). You would have hit this immediately after fixing #1.

Fix: build scripts now run under
`NODE_OPTIONS=--max-old-space-size=8192` (set via `cross-env`, Windows-safe),
matching the value the `check` script already used.

### 3. Packaging hook failure: `npm ci` inside `release/app` (EUSAGE)
**File:** `.erb/scripts/ensure-app-deps.cjs` (the `beforePack` hook)

`release/app` is a member of the root bun workspaces. npm walks up from
`release/app`, detects the workspace root, switches to it and demands a root
`package-lock.json` — which does not exist (you use `bun.lock`). Result:
`npm error The npm ci command can only install with an existing package-lock.json`.

Fix: the hook now runs
`npm ci --omit=dev --ignore-scripts --workspaces=false --include-workspace-root=false`
plus matching `npm_config_*` env guards.

### 4. Broken `chatboxProvider` stub in ModelSelectorV2 (6 TS errors)
**File:** `src/renderer/components/ModelSelectorV2/index.tsx`

`const chatboxProvider = useMemo(() => undefined, [])` was a stub that typed
`chatboxProvider` as `never` (errors like "Property 'id' does not exist on type
'never'") and silently removed the Fibonacci AI group from the model selector.
Restored the real implementation (resolve from the model catalog or the
provider list).

### 5. Missing Fibonacci entry in `aiProviderNameHash` (TS2741)
**File:** `src/shared/models/index.ts`

Adding `Fibonacci` to `ModelProviderEnum` made `Record<ModelProviderEnum, string>`
incomplete. Added `[ModelProviderEnum.Fibonacci]: 'Fibonacci AI'`.

### 6. `capabilities` typed as `string[]` in the Fibonacci catalog (TS2322)
**File:** `src/shared/providers/definitions/models/fibonacci.ts`

`FIBONACCI_MODELS` is now explicitly typed
`Array<Omit<ProviderModelInfo, 'type'>>` so `capabilities` entries are checked
against the `'vision' | 'reasoning' | 'tool_use' | 'web_search'` union.

### 7. DeepSeek `'xhigh'` reasoning effort rejected by SDK types (TS1360)
**File:** `src/shared/providers/definitions/models/deepseek.ts`

`@ai-sdk/deepseek` 2.0.62 (pinned in your `bun.lock`) only accepts
`'low' | 'high' | 'max'` for the native chat API. `'xhigh'` is now clamped to
`'max'` at the request boundary (consistent with how `reasoning-control.ts`
handles Anthropic-only values).

## Verification performed
- `tsc --noEmit`: 0 errors (was 10)
- `bun run build:main` / `build:preload`: success
- Renderer production build (all 17,391 modules + minification): success
- `electron-builder` full pipeline (beforePack → npm ci → version-skew check →
  native rebuild → packaging → afterPack: ripgrep/libsql/runtime-deps): success
- Note: this sandbox has 4 GB RAM; your Windows machine needs ~6+ GB free RAM
  for the renderer minification step — with fix #2 the heap now grows properly.

## How to use
1. Back up your current folder, then extract this archive over it
   (or extract fresh and copy your untracked `.env`/local files back).
2. `bun install`
3. Before packaging, close any running "Fibonacci Chat Area" build and
   (recommended) add the project's `release` folder to Windows Defender
   exclusions.
4. `bun run package` — output lands in `release/build` (NSIS installer +
   `win-unpacked`).
