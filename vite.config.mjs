import { defineConfig } from 'vite';

// Vite v6: set root via config instead of CLI flags
export default defineConfig({
  root: 'client',
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 5173,
  },
});
