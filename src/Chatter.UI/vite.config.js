import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    })
  ],
  base: './', // 👈 BU SATIRI EKLE: Electron'un dosyaları bulabilmesi için şarttır
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist', // Çıktı klasörü ismi
  }
})