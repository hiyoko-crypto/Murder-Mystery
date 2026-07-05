import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health':    'http://localhost:8000',
      '/scenario':  'http://localhost:8000',
      '/scenarios': 'http://localhost:8000',
      '/chat':      'http://localhost:8000',
      '/state':     'http://localhost:8000',
      '/briefing':  'http://localhost:8000',
      '/examine':   'http://localhost:8000',
      '/indict':    'http://localhost:8000',
      '/reset':     'http://localhost:8000',
    },
  },
})
