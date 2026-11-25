import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
})
