import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/game': resolve(__dirname, 'src/game'),
      '@/controls': resolve(__dirname, 'src/controls'),
      '@/pages': resolve(__dirname, 'src/pages'),
      '@/pwa': resolve(__dirname, 'src/pwa')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        lobby: resolve(__dirname, 'lobby.html'),
        game: resolve(__dirname, 'game.html'),
        settings: resolve(__dirname, 'settings.html')
      },
      output: {
        manualChunks: {
          'app-shell': ['./src/components/AppShell.ts'],
          'game-engine': ['./src/game/GameEngine.ts', './src/game/Renderer.ts'],
          'ui-components': ['./src/components/MobileControls.ts', './src/components/ChatPanel.ts'],
          'socket-client': ['socket.io-client']
        }
      }
    },
    target: 'esnext',
    minify: 'terser',
    sourcemap: true
  },
  server: {
    host: '0.0.0.0',
    port: 3011,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 3011,
    strictPort: true
  }
});