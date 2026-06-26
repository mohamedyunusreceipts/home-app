import type { MetadataRoute } from 'next'

/**
 * PWA web app manifest (Next 16 metadata route). Next auto-links this from the
 * document head, so no manual <link rel="manifest"> is required.
 *
 * Colors come from the warm palette in app/globals.css:
 *   theme_color      → terracotta-400 #C77B5C
 *   background_color → cream-100       #FAF6EF
 *
 * TODO(pwa-polish): ship real maskable PNG icons at /icon-192.png and
 * /icon-512.png. Until those binaries exist we reference the existing
 * favicon.ico so installs and the build don't break.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Home',
    short_name: 'Home',
    description: 'Shared home management for couples',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF6EF',
    theme_color: '#C77B5C',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
