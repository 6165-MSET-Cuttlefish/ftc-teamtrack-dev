import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { createServer } from './server';

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
  plugins: [react(), webSocketFixPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
}));

function webSocketFixPlugin(): Plugin {
  return {
    name: 'websocket-fix-plugin',
    apply: 'serve',
    configureServer(server) {
      // Wrap the server's WebSocket handling to catch RSV1 errors
      const originalCreateWebSocketServer = (server as any).createWebSocketServer;
      if (originalCreateWebSocketServer) {
        (server as any).createWebSocketServer = function(...args: any[]) {
          const ws = originalCreateWebSocketServer.apply(this, args);
          
          // Override error handling
          if (ws && ws.on) {
            ws.on('error', (error: Error) => {
              if (error.message.includes('RSV1') || 
                  error.message.includes('WebSocket frame') ||
                  (error as any).code === 'WS_ERR_UNEXPECTED_RSV_1') {
                console.warn('🔄 WebSocket compression error ignored - continuing...');
                return; // Don't propagate the error
              }
              console.error('WebSocket error:', error);
            });
          }
          
          return ws;
        };
      }
    },
  };
}

function _expressPlugin(): Plugin {
  return {
    name: 'express-plugin',
    apply: 'serve', // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
