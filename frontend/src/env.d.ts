/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Absolute API origin for Capacitor builds when Settings has no server URL */
  readonly VITE_NATIVE_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@/router/documentTitle' {
  import type { Router } from 'vue-router'
  export function registerDocumentTitle(router: Router): void
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
