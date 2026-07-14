import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Providers } from '@/components/providers'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n'
import { getSiteSettings, localizedTitle, localizedDescription } from '@/lib/site-settings'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

const SITE_NAME = 'tldbi.com'

async function currentLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return cookieStore.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'zh'
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, locale] = await Promise.all([getSiteSettings(), currentLocale()])
  const title = localizedTitle(settings, locale)
  const description = localizedDescription(settings, locale)

  // favicon:后台设置了图片则用它,否则回退内置 SVG 图标
  const icon = settings.faviconUrl ? [{ url: settings.faviconUrl }] : [{ url: '/icon.svg', type: 'image/svg+xml' }]

  return {
    metadataBase: new URL('https://tldbi.com'),
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    keywords: ['域名比价', '域名价格', '域名注册', '域名续费', '域名转入', 'TLD 价格', '最便宜域名注册商', 'domain price comparison'],
    applicationName: SITE_NAME,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: 'https://tldbi.com',
      locale: locale === 'en' ? 'en_US' : 'zh_CN',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
    icons: {
      icon,
      apple: settings.faviconUrl ?? '/icon.svg',
    },
  }
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
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const initialLocale: Locale = cookieLocale === 'en' ? 'en' : 'zh'

  return (
    <html lang={initialLocale === 'en' ? 'en' : 'zh-CN'} className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers initialLocale={initialLocale}>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
