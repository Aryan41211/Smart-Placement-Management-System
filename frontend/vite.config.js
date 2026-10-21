import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies every `/api` call to the Django development server so
// the browser always talks to a single origin and CORS never enters the
// picture during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
