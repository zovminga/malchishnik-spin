import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const sharedServer = {
  host: '0.0.0.0' as const,
  port: 43177,
  strictPort: true,
  // Cloud Agent / Cursor preview proxies send a non-localhost Host header.
  allowedHosts: true as const,
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: sharedServer,
  preview: sharedServer,
})
