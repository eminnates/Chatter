import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 👈 BU SATIRI EKLE: Electron'un dosyaları bulabilmesi için şarttır
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist', // Çıktı klasörü ismi
  }
})