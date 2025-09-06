import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vite v6: set root via config instead of CLI flags
export default defineConfig({
  root: 'client',
  // Ensure env files are read from the project root (where .env lives)
  envDir: process.cwd(),
  // Be explicit about which variables are exposed to the client
  envPrefix: 'VITE_',
  // Allow importing from project-level shared/ for client code
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    }
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 5173,
  },
});
