import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Defaults to localhost for native `npm run dev`. When run inside
      // Docker Compose, docker-compose.override.yml sets VITE_PROXY_HOST=backend
      // so this resolves to the backend *container* instead of the
      // frontend container's own loopback address.
      '/api': { target: `http://${process.env.VITE_PROXY_HOST || 'localhost'}:8000`, changeOrigin: true },
      '/ws': { target: `ws://${process.env.VITE_PROXY_HOST || 'localhost'}:8000`, ws: true },
      // Uploaded WhatsApp media (images, documents, etc.) is served by
      // the backend at /media/ — without this, MessageSerializer's
      // media_url would 404 in local dev (only /api and /ws were
      // proxied before). Production doesn't need this since nginx
      // routes /media/ directly (see nginx/nginx.conf).
      '/media': { target: `http://${process.env.VITE_PROXY_HOST || 'localhost'}:8000`, changeOrigin: true },
    },
  },
})
