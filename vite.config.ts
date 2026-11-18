import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // the single-file build defines this as true (tools/build-standalone.mjs); the server build keeps the normal server mode
  define: { __STANDALONE__: 'false' },
  server: {
    // lvh.me points to 127.0.0.1; TikTok LIVE Studio does not accept "localhost"
    allowedHosts: ['lvh.me'],
  },
});
