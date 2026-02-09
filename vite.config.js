import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,        // ✅ always use this port
    strictPort: true,  // ✅ fail instead of switching to another port
    // host: true,     // (optional) allows LAN access (e.g. phone preview)
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})

