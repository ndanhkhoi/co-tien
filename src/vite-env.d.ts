/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __ART_CACHE__: string;
declare module 'virtual:art-manifest' {
  /** [path relative to the site root (art/…), size in bytes] */
  const files: [string, number][];
  export default files;
}
