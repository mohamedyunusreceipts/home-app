import type { MetadataRoute } from 'next'

/**
 * PWA web app manifest (Next 16 metadata route). Next auto-links this from the
 * document head, so no manual <link rel="manifest"> is required.
 *
 * Colors come from the warm palette in app/globals.css:
 *   theme_color      → terracotta-400 #C77B5C
 *   background_color → cream-100       #FAF6EF
 *
 * Icons are generated at build time by app/icon.tsx (512×512) and
 * app/apple-icon.tsx (180×180) via next/og's ImageResponse — real PNGs with
 * no committed binaries. We reference the 512 icon here for both the standard
 * "any" purpose and a "maskable" entry (the icon fills its tile edge-to-edge,
 * keeping the glyph inside the maskable safe zone). The favicon.ico stays as a
 * universal fallback.
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
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
