// Spike: Vitest Browser Mode as the runner for bundles produced by Karma's webpack config.
// Build them first: `node test/vitest-webpack/build.cjs` (see the env vars documented there).
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root,
  // The bundles are prebuilt by webpack; keep Vite from scanning or pre-bundling their contents.
  optimizeDeps: {
    entries: [],
    include: ['chai', 'sinon'],
  },
  server: {
    watch: null,
  },
  test: {
    include: ['build/vitest-bundles/**/*_spec.js'],
    exclude: ['build/vitest-bundles/_chunks/**'],
    setupFiles: ['test/vitest-webpack/setup.mjs'],
    globals: false,
    // Mocha runs after/afterEach hooks in registration order
    sequence: {hooks: 'list'},
    // timeouts are enforced by the Mocha shim in setup.mjs (default 3000ms, honoring this.timeout())
    testTimeout: 0,
    hookTimeout: 0,
    isolate: true,
    fileParallelism: !!process.env.VITEST_PARALLEL,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{browser: 'chromium'}],
      screenshotFailures: false,
    },
  },
});
