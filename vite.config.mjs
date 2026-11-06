import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'frontend',
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    cors: false,
    fs: {
      // The frontend imports this pure offer catalogue, not the rest of the repository.
      allow: [resolve('frontend'), resolve('backend/src/modules/enquiries/offer.ts')],
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
    },
  },
  build: {
    manifest: true,
    outDir: resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(process.cwd(), 'frontend/index.html'),
        privacy: resolve(process.cwd(), 'frontend/privacy/index.html'),
        terms: resolve(process.cwd(), 'frontend/terms/index.html'),
      },
    },
  },
});
