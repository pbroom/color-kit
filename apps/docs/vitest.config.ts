import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  }),
);
