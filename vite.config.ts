import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'fun-profile-logo-128.webp', 'apple-touch-icon.png'],
      manifest: {
        name: 'FUN Profile - Connect, Share, Earn',
        short_name: 'FUN Profile',
        description: 'Mạng xã hội Web3 kết hợp AI. Kết nối bạn bè, chia sẻ nội dung, kiếm phần thưởng Camly Coin.',
        theme_color: '#22c55e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB - for large Web3 chunks
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/bhtsnervqiwchluwuxki\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300
              }
            }
          },
          {
            urlPattern: /^https:\/\/media\.fun\.rich\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Web3 libs - separate chunk, only loaded on Wallet page
          if (id.includes('wagmi') || id.includes('viem') || id.includes('rainbowkit') || id.includes('@walletconnect')) {
            return 'vendor-web3';
          }
          // Core React - load first
          if (id.includes('react-dom') || (id.includes('node_modules/react') && !id.includes('react-'))) {
            return 'vendor-react';
          }
          if (id.includes('react-router-dom')) {
            return 'vendor-router';
          }
          // Data layer
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          // UI libraries
          if (id.includes('@radix-ui/react-dialog') || 
              id.includes('@radix-ui/react-dropdown-menu') ||
              id.includes('@radix-ui/react-popover') ||
              id.includes('@radix-ui/react-tooltip') ||
              id.includes('@radix-ui/react-avatar')) {
            return 'vendor-ui-core';
          }
          if (id.includes('@radix-ui/react-checkbox') ||
              id.includes('@radix-ui/react-label') ||
              id.includes('@radix-ui/react-select') ||
              id.includes('@radix-ui/react-tabs')) {
            return 'vendor-ui-forms';
          }
          // Charts - loaded when needed
          if (id.includes('recharts')) {
            return 'vendor-charts';
          }
          // Utils
          if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'vendor-utils';
          }
        },
      },
    },
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 300,
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@tanstack/react-query',
      '@supabase/supabase-js',
      'eventemitter3',
    ],
    exclude: [
      // Exclude large libs - load on demand only when needed
      'recharts',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  // Performance hints
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
}));
