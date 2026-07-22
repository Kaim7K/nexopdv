import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('node_modules/react')) return 'react-vendor';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('@hello-pangea/dnd')) return 'dnd';
          if (id.includes('@radix-ui')) return 'radix-ui';
          if (id.includes('@e965/xlsx')) return 'xlsx';
          if (id.includes('jspdf')) return 'pdf';
          return undefined;
        },
      },
    },
  },
})
