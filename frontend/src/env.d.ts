/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

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
