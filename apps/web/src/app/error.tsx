'use client';

/**
 * The page-level failure surface. If the product ever throws, the person sees the same calm paper,
 * an honest sentence, and a way to try again — never a stack trace, never a blank screen. The
 * board is in-page state, so "try again" genuinely restores a working product.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#fafaf6',
        color: '#18181b',
        fontFamily: 'Georgia, serif',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '34rem' }}>
        <p style={{ borderTop: '4px solid #d97706', paddingTop: '1.25rem', fontSize: '2rem', margin: 0 }}>
          Something broke on this page.
        </p>
        <p style={{ color: '#555c62', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Nothing real was at stake — Cedarfield is a fictional clinic. Reloading brings the board back.
        </p>
        <p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: 'inherit',
              color: '#fafaf6',
              background: '#18181b',
              border: 0,
              borderRadius: '0.5rem',
              padding: '0.6rem 1.2rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </p>
      </div>
    </main>
  );
}
