import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
          if (id.includes('@e965') || id.includes('xlsx')) return 'spreadsheet';
          if (id.includes('@hello-pangea')) return 'drag-drop';
          if (id.includes('react') || id.includes('react-router-dom'))
            return 'react-vendor';
          return undefined;
        },
      },
    },
  },
})
