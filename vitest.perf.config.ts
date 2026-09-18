import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Dedicated config for the perf micro-benchmarks under `benchmarks/perf`.
 *
 * Kept out of the default `vitest.config.ts` include patterns so the normal
 * `bun run test` / CI suites never pay for them. Run explicitly:
 *
 *   npx vitest run --config vitest.perf.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['benchmarks/**/*.bench.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Benchmarks report through console.log.
    silent: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      src: path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.cjs'],
  },
})
