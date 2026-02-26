import { useEffect } from 'react';

const Mobile = () => {
  useEffect(() => {
    document.title = 'Mobile Not Supported - TeamTrack';
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#0f1419',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(83, 119, 136, 0.1)',
            margin: '0 auto 1.5rem',
            fontSize: '2.5rem',
          }}
        >
          🖥️
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Mobile Support Coming Soon
        </h1>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>
          Mobile support is coming in a future update. Please use TeamTrack on a computer.
        </p>
      </div>
    </div>
  );
};

export default Mobile;
