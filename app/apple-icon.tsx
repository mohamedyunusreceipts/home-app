import { ImageResponse } from 'next/og'

/**
 * Generated iOS home-screen icon (Next 16 metadata route). Next serves this at
 * /apple-icon and auto-links it as <link rel="apple-touch-icon"> — no manual
 * tag needed.
 *
 * Same warm design as app/icon.tsx (terracotta tile, cream serif "H") at the
 * iOS-recommended 180×180. iOS applies its own rounded mask, so we fill solid
 * terracotta edge-to-edge and centre the glyph in the safe zone.
 */

// Image metadata
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

// Image generation
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#C77B5C',
          color: '#FFFCF7',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 120,
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
