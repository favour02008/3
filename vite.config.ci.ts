import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub CI validates the React/Vite source without bundling AppDeploy's
// platform-provided browser SDK. The production AppDeploy build uses the
// regular vite.config.ts and receives @appdeploy/client from the platform.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-ci',
    rollupOptions: {
      external: ['@appdeploy/client'],
    },
  },
});
