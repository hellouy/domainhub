import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { Providers } from '@/components/providers'
import { CURRENCY_COOKIE, normalizeCurrency } from '@/lib/currency/constants'
import { LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n/dictionaries'
import { currencyService } from '@/services/currency'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'DomainHub — 全球域名注册商价格比较',
    template: '%s | DomainHub',
  },
  description:
    'DomainHub 聚合 Cloudflare、Porkbun、Namecheap 等全球主流域名注册商的注册、续费与转入价格，帮助你找到最便宜的域名注册商。',
  generator: 'v0.app',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  const currency = normalizeCurrency(cookieStore.get(CURRENCY_COOKIE)?.value)
  const rates = await currencyService.getRates()

  return (
    <html lang={locale === 'en' ? 'en' : 'zh-CN'} className="bg-background">
      <body className="font-sans antialiased">
        <Providers locale={locale} currency={currency} rates={rates}>
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
