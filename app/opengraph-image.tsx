import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'tldbi.com — TLD domain price comparison'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '52px 56px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #0b63f6 42%, #7dd3fc 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '10px 18px',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.34)',
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 1.5,
            }}
          >
            TLD
          </div>
          <div style={{ fontSize: 28, opacity: 0.9, letterSpacing: 1.2 }}>tldbi.com</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            Compare domain prices
          </div>
          <div style={{ fontSize: 32, opacity: 0.92, maxWidth: 850, lineHeight: 1.25 }}>
            Find the cheapest registrar for .com, .io, .ai, .shop and 1000+ TLDs.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {['live pricing', 'global', 'fast comparison'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '12px 20px',
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
