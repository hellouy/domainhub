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
          padding: '44px 54px',
          background: 'linear-gradient(135deg, #071426 0%, #0f172a 20%, #0b63f6 55%, #7dd3fc 100%)',
          color: '#f8fbff',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18), transparent 22%), radial-gradient(circle at 18% 82%, rgba(125,211,252,0.18), transparent 22%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #e2f3ff 0%, #9ad4ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 28px rgba(11,99,246,0.42)',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(11, 99, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    height: 20,
                  }}
                >
                  <div style={{ width: 5, height: 8, background: '#0b63f6', borderRadius: 3 }} />
                  <div style={{ width: 5, height: 12, background: '#0b63f6', borderRadius: 3 }} />
                  <div style={{ width: 5, height: 18, background: '#0b63f6', borderRadius: 3 }} />
                  <div style={{ width: 5, height: 14, background: '#0b63f6', borderRadius: 3 }} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: '#f8fbff' }}>tldbi.com</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.28)',
              border: '1px solid rgba(255,255,255,0.18)',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            LIVE PRICING
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
            marginTop: 38,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ flex: 1.25, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 82, fontWeight: 900, lineHeight: 0.96, letterSpacing: -3, maxWidth: 670 }}>
              最便宜的
            </div>
            <div style={{ fontSize: 82, fontWeight: 900, lineHeight: 0.96, letterSpacing: -3, marginTop: 10, maxWidth: 670 }}>
              域名价格
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
              {['.com', '.io', '.ai', '.shop', '.info', '.xyz'].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 96,
                    height: 42,
                    padding: '0 18px',
                    borderRadius: 999,
                    background: 'rgba(15, 23, 42, 0.34)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#f8fbff',
                    fontSize: 24,
                    fontWeight: 700,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 0.7,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                background: 'rgba(15, 23, 42, 0.27)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 26,
                padding: '28px 26px',
                minWidth: 300,
                boxShadow: '0 18px 32px rgba(15,23,42,0.18)',
              }}
            >
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                from
              </div>
              <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: -2, lineHeight: 1, marginTop: 8 }}>US$ 8.99</div>
              <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.82)', marginTop: 10 }}>/ year</div>
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {[ '1,800+ TLDs', '200+ registrars', 'real-time prices' ].map((meta) => (
                <div
                  key={meta}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 16px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#e2f3ff',
                  }}
                >
                  {meta}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}

