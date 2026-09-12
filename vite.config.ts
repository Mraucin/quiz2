import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the bundle works from any GitHub Pages sub-path
// (https://<user>.github.io/<repo>/) as well as from the local dev server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    host: true,
    port: 43717,
  },
  preview: {
    port: 43718,
  },
})
