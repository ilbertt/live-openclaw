import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://localhost:3000', '/rpc': { target: 'ws://localhost:3000', ws: true } },
  },
});
