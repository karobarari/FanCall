import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend test config. Deliberately separate from vite.config.ts so the
// tailwind plugin (irrelevant to tests) never runs here. Server tests live in
// server/ with their own jest config — this covers src/ only.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
