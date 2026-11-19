import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Link previews (WhatsApp and others) want absolute image URLs. When VITE_SITE_URL is set at build
// time, the share-tag images in index.html are made absolute. The inline theme script is not touched,
// so its CSP hash in vercel.json stays valid.
const absoluteShareImages = () => ({
  name: 'absolute-share-images',
  transformIndexHtml: (html) => {
    const site = (process.env.VITE_SITE_URL || '').replace(/\/+$/, '')
    return site ? html.replaceAll('content="/images/', `content="${site}/images/`) : html
  },
})

export default defineConfig({
  plugins: [react(), absoluteShareImages()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000'
    }
  },
  build: {
    target: 'es2019',
    rollupOptions: {
      output: {
        // Long-lived vendor chunk: it rarely changes, so browsers keep it cached between deploys.
        // framer-motion is left to Rollup so its animation features load in their own chunk
        // after first paint (LazyMotion in main.jsx).
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
