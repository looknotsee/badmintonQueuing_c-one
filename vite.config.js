import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
  qrcode() // Automatically runs only in development mode
  ],
  server: {
    host: true // Exposes the server to the network so your phone can connect
  }
})
