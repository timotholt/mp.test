import { defineConfig } from 'vite';

// Vite v6: set root via config instead of CLI flags
export default defineConfig({
  root: 'client',
  // Ensure env files are read from the project root (where .env lives)
  envDir: process.cwd(),
  // Be explicit about which variables are exposed to the client
  envPrefix: 'VITE_',
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 5173,
  },
});
