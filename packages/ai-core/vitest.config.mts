import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.(js|ts)'],
    environment: 'node',
    maxWorkers: 1,
    // Isolation stays ON. With `isolate: false` every file shares one module
    // registry, so agent-loop.test.ts's `vi.mock('#providers/registry')` leaked
    // into workflow.test.ts, whose `vi.spyOn` on the same module then could not
    // override the already-installed factory — runWorkflow got agent-loop's
    // `{ modelId: 'test' }` stub instead of its own model. It only broke when
    // file ordering put agent-loop first, so it passed on Windows and failed on
    // CI. Costs ~2s on this suite; correctness is worth more.
    reporters: process.env.CI
      ? [
          'default',
          [
            'junit',
            { outputFile: './test-results/junit.xml', suiteName: 'ai-core' },
          ],
        ]
      : ['default'],
  },
});
