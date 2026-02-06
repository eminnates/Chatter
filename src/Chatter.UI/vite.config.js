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
  base: process.env.VERCEL ? '/' : './', // Vercel'de '/', Electron'da './'
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Vercel için source map'leri devre dışı bırak (daha küçük build)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'signalr-vendor': ['@microsoft/signalr']
        }
      }
    }
  }
})