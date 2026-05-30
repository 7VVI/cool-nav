import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/siyuan': {
        target: 'http://localhost:6806',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/siyuan/, ''),
        ws: true
      }
    }
  }
});