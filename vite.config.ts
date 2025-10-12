import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode: _mode }) => ({
  root: './client',
  server: {
    host: 'localhost', // Use localhost instead of IPv6
    port: 8080,
    hmr: {
      // Use polling instead of WebSocket to avoid compression issues
      port: 24678,
      // Disable overlay for errors
      overlay: false,
      clientPort: 24678,
    },
    watch: {
      // Use polling for file watching (more reliable)
      usePolling: true,
      interval: 1000,
    },
    fs: {
      allow: ['.', '../', './src'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**'],
    },
  },
  build: {
    outDir: '../dist/spa',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
}));
