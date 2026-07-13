import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

const SITE_NAME = 'tldbi.com'
const SITE_TITLE = 'tldbi.com — 全球域名后缀比价 · 注册/续费/转入最低价查询'
const SITE_DESCRIPTION =
  'tldbi.com 聚合 Cloudflare、Porkbun、Dynadot、Gandi 等全球主流域名注册商的实时价格，覆盖 1800+ 域名后缀的注册、续费与转入报价，一键找到最便宜的注册商。'

export const metadata: Metadata = {
  metadataBase: new URL('https://tldbi.com'),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['域名比价', '域名价格', '域名注册', '域名续费', '域名转入', 'TLD 价格', '最便宜域名注册商', 'domain price comparison'],
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: 'https://tldbi.com',
    locale: 'zh_CN',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'tldbi.com — 全球域名后缀比价',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1b1a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
