import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When running inside Docker Compose, 'http://web:8000' reaches the FastAPI container.
// When running locally outside Docker, 'http://localhost:8000' is used.
const backendUrl = process.env.VITE_BACKEND_URL || 'http://web:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/payments': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/health': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
