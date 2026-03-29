import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util'],
      globals: { Buffer: true, process: true },
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Chatter',
        short_name: 'Chatter',
        description: 'Real-time messaging and video calling',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // API responses: always try network first, fall back to cache
            urlPattern: /^https?:\/\/.*\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 10
            }
          },
          {
            // Uploaded files: stable URLs, cache forever
            urlPattern: /^https?:\/\/.*\/uploads\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  base: process.env.VERCEL ? '/' : './', // Vercel'de '/', Electron'da './'
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'signalr-vendor': ['@microsoft/signalr'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/app', '@capacitor/keyboard', '@capacitor/haptics'],
          // lucide-react removed from manualChunks: putting it here bundles ALL ~1000 icons
          // into one chunk. Without it, Vite tree-shakes to only the ~20 icons actually imported.
          // Result: ~200KB -> ~15KB
          'webrtc-vendor': ['simple-peer'],
          'tauri-vendor': ['@tauri-apps/api']
        }
      }
    }
  }
})