import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { NavigationFeedback } from '@/components/navigation-feedback'
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

  // 后台自定义 favicon 优先,未设置时使用项目品牌图标
  const icon = settings.faviconUrl
    ? [{ url: settings.faviconUrl }]
    : [{ url: '/favicon.ico' }, { url: '/icon.svg', type: 'image/svg+xml' }]

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
      images: [{
        url: '/og-image.png',
        width: 1424,
        height: 752,
        alt: 'TLDbi.com domain price comparison',
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    category: 'technology',
    authors: [{ name: SITE_NAME, url: 'https://tldbi.com' }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon,
      apple: settings.faviconUrl || '/apple-touch-icon.png',
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  viewportFit: 'cover',
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

  const settings = await getSiteSettings()
  const siteTitle = localizedTitle(settings, initialLocale)
  const siteDescription = localizedDescription(settings, initialLocale)

  // 站点级结构化数据:帮助搜索引擎识别站点身份,并让生成式引擎/AI 准确引用品牌与搜索入口
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://tldbi.com/#website',
        url: 'https://tldbi.com',
        name: SITE_NAME,
        description: siteDescription,
        inLanguage: initialLocale === 'en' ? 'en' : 'zh-CN',
        publisher: { '@id': 'https://tldbi.com/#organization' },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://tldbi.com/tlds?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://tldbi.com/#organization',
        name: SITE_NAME,
        url: 'https://tldbi.com',
        description: siteDescription,
        logo: settings.logoUrl
          ? { '@type': 'ImageObject', url: settings.logoUrl }
          : { '@type': 'ImageObject', url: 'https://tldbi.com/icon.svg' },
      },
    ],
  }

  return (
    <html lang={initialLocale === 'en' ? 'en' : 'zh-CN'} className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <Providers initialLocale={initialLocale}>
          <NavigationFeedback />
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
