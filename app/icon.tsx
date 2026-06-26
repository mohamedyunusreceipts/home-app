import { ImageResponse } from 'next/og'

/**
 * Generated app icon (Next 16 metadata route). Next serves this at /icon and
 * auto-links it from the document head — no manual <link rel="icon"> needed.
 *
 * Design: a terracotta rounded tile with a cream serif "H", matching the warm
 * palette in app/globals.css (terracotta-400 #C77B5C on cream-50). Rendered to
 * a real PNG at build time via next/og's ImageResponse, so we get a usable /
 * maskable icon without committing any binary assets.
 */

// Image metadata
export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Solid terracotta fill edge-to-edge so the icon reads well as a
          // maskable icon (the safe zone keeps the "H" away from any crop).
          background: '#C77B5C',
          color: '#FFFCF7',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 340,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        H
      </div>
    ),
    {
      ...size,
    },
  )
}
