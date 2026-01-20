/// <reference types="vite/client" />

// Global constants defined in vite.config.ts
declare const __DEV__: boolean;
declare const __PROD__: boolean;

// Extend ImportMetaEnv with custom environment variables
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_API_WITH_CREDENTIALS?: string;
  readonly VITE_API_DEBUG?: string;
  readonly VITE_DEV_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
