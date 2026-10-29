/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __ART_VERSION__: string;
declare module 'virtual:art-manifest' {
  /** [path relative to the site root (art/…), size in bytes, content revision] */
  const files: [string, number, string][];
  export default files;
}
