import Link from 'next/link';

/** A wrong URL gets the same calm paper as the product, and one way home. */
export default function NotFound() {
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
          There is no page here.
        </p>
        <p style={{ color: '#555c62', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Nothing was booked, held, or lost — this address simply doesn&apos;t exist.
        </p>
        <p>
          <Link href="/" style={{ color: '#d97706' }}>
            Back to Cedarfield Clinic
          </Link>
        </p>
      </div>
    </main>
  );
}
