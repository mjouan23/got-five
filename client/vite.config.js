import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'Meeplix',
        short_name: 'Meeplix',
        description: 'Jeu de société multijoueur en temps réel',
        theme_color: '#07090c',
        background_color: '#07090c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}']
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true
      },
      '/socket.io': {
        target: apiProxyTarget,
        ws: true,
        changeOrigin: true
      }
    }
  }
});
