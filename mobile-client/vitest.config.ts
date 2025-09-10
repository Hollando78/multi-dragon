import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/game': resolve(__dirname, 'src/game'),
      '@/controls': resolve(__dirname, 'src/controls'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/pwa': resolve(__dirname, 'src/pwa')
    }
  }
});