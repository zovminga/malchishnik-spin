import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 43177,
    strictPort: true,
    // Cloud Agent / Cursor preview proxies send a non-localhost Host header.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43177,
    strictPort: true,
    allowedHosts: true,
  },
})
