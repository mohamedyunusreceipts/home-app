'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

/**
 * Root fatal error boundary. Replaces the root layout when active, so it must
 * render its own <html> and <body>. The app's stylesheet is not guaranteed
 * here, so the warm theme colours are inlined to stay on-brand even in a hard
 * failure.
 *
 * Accepts both `unstable_retry` (Next 16.2) and `reset` (older) — see
 * app/(app)/error.tsx for the rationale.
 */
export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const retry = unstable_retry ?? reset

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#FAF6EF',
          color: '#3F2118',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.875rem',
              color: '#793F2D',
              margin: '0 0 1rem',
            }}
          >
            We hit a snag
          </h1>
          <p style={{ color: '#3B523C', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Something went badly wrong and the whole app stumbled. Reloading
            usually puts everything back the way it was.
          </p>
          {error.digest ? (
            <p style={{ fontSize: '0.75rem', color: '#4B684C', margin: '0 0 1rem' }}>
              Reference: <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
            </p>
          ) : null}
          {error?.message ? (
            <pre
              style={{
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                background: '#F0E9DD',
                color: '#793F2D',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                margin: '0 0 1.5rem',
                maxHeight: '14rem',
                overflow: 'auto',
              }}
            >
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          ) : null}
          {retry ? (
            <button
              onClick={() => retry()}
              style={{
                cursor: 'pointer',
                border: 'none',
                borderRadius: '0.5rem',
                backgroundColor: '#C77B5C',
                color: '#FFFDF9',
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '0.5rem 1rem',
              }}
            >
              Try again
            </button>
          ) : null}
        </div>
      </body>
    </html>
  )
}
