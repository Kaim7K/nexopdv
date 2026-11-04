import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), {
    name: 'private-preview-shell',
    configurePreviewServer(server) {
      // Match the production SPA rewrite without serving landing HTML on private URLs.
      server.middlewares.use((req, _res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname !== '/' && !pathname.split('/').pop().includes('.')) req.url = '/app.html';
        next();
      });
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Scan the real app entry, not generated HTML from disposable browser builds.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    chunkSizeWarningLimit: 550,
    manifest: true,
    rollupOptions: {
      output: {
        // Keep shared dependencies out of feature chunks to avoid pulling lazy
        // charts, PDF and drag-and-drop libraries into the initial module graph.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (/\/node_modules\/react-router(?:-dom)?\//.test(id)) return 'router';
          if (/\/node_modules\/(?:react|react-dom|scheduler|use-sync-external-store|react-is)\//.test(id)) return 'react-vendor';
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
