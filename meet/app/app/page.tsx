export default function Page() {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        padding: '0 1rem',
      }}
    >
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>Cut Stream</h1>
        <p style={{ color: '#888', margin: 0 }}>
          Please use the session link you were sent.
        </p>
      </div>
    </main>
  );
}
