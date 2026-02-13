import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as path from 'path';

export default defineConfig(({ mode }) => {
  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/apps/web',

    // Development server configuration
    server: {
      port: 3000,
      host: true, // Listen on all addresses (0.0.0.0)
      strictPort: false, // Try next port if 3000 is taken
      open: false, // Don't auto-open browser
      cors: true,
      fs: {
        allow: [path.resolve(__dirname, '../..')],
      },
      // Proxy API requests to backend during development
      // Note: Vite automatically loads VITE_ prefixed env vars
      proxy: mode === 'development' ? {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      } : undefined,
    },

    preview: {
      port: 3001,
      host: 'localhost',
    },

    plugins: [
      react({
        // Fast Refresh is enabled by default
        babel: {
          plugins: [
            // Add any Babel plugins for dev mode here
          ],
        },
      }),
      nxViteTsPaths(),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', '@chakra-ui/react', 'zustand', 'axios'],
    },

    build: {
      outDir: '../../dist/apps/web',
      emptyOutDir: true,
      reportCompressedSize: true,
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'chakra-vendor': ['@chakra-ui/react', '@emotion/react', '@emotion/styled'],
            'utils': ['zustand', 'axios'],
          },
        },
      },
    },

    // Environment variable handling
    envPrefix: 'VITE_',

    // Define global constants
    define: {
      __DEV__: mode === 'development',
      __PROD__: mode === 'production',
    },
  };
});
