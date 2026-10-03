import type { Metadata } from 'next'
import type { Locale } from '@/lib/i18n'

type MetadataConfig = {
  title: string
  description: string
  keywords: string[]
}

const metadataByLocale: Record<Locale, MetadataConfig> = {
  zh: {
    title: 'tldbi.com — 全球域名后缀比价 · 注册/续费/转入最低价查询',
    description:
      'tldbi.com 聚合 Cloudflare、Porkbun、Dynadot、Gandi 等全球主流域名注册商的实时价格，覆盖 1800+ 域名后缀的注册、续费与转入报价，一键找到最便宜的域名注册商。',
    keywords: [
      '域名比价',
      '域名价格',
      '域名注册',
      '域名续费',
      '域名转入',
      'TLD价格',
      '最便宜域名',
      '域名便宜',
      '域名优惠',
      '全球域名',
      'Cloudflare Registrar',
      'Porkbun',
      'Dynadot',
      'Gandi',
    ],
  },
  en: {
    title: 'tldbi.com — Global TLD Domain Price Comparison & Registrar Rates',
    description:
      'tldbi.com aggregates real-time domain prices from Cloudflare, Porkbun, Dynadot, Gandi and 50+ registrars across 1800+ TLDs. Find the cheapest domain registration, renewal and transfer rates instantly.',
    keywords: [
      'domain price comparison',
      'cheapest domain registrar',
      'TLD pricing',
      'domain registration',
      'domain renewal',
      'domain transfer',
      'Cloudflare',
      'Porkbun',
      'Dynadot',
      'Gandi',
      '.com',
      '.io',
      '.ai',
      'domain prices',
      'registrar comparison',
    ],
  },
}

export function getLocalizedMetadata(locale: Locale): MetadataConfig {
  return metadataByLocale[locale] || metadataByLocale.en
}

export function generateBaseMetadata(locale: Locale = 'en'): Metadata {
  const config = getLocalizedMetadata(locale)
  const isEn = locale === 'en'

  return {
    title: {
      default: config.title,
      template: `%s | tldbi.com`,
    },
    description: config.description,
    keywords: config.keywords,
    applicationName: 'tldbi.com',
    creator: 'tldbi.com',
    referrer: 'strict-origin-when-cross-origin',
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'tldbi.com',
      title: config.title,
      description: config.description,
      url: 'https://tldbi.com',
      locale: isEn ? 'en_US' : 'zh_CN',
      alternateLocale: isEn ? ['zh_CN'] : ['en_US'],
      images: [
        {
          url: 'https://tldbi.com/opengraph-image',
          width: 1200,
          height: 630,
          alt: config.title,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: config.title,
      description: config.description,
      images: ['https://tldbi.com/twitter-image'],
      creator: '@tldbi',
      site: '@tldbi',
    },
    verification: {
      google: 'your-google-site-verification',
    },
    alternates: {
      canonical: 'https://tldbi.com',
      languages: {
        'en-US': 'https://tldbi.com/en',
        'zh-CN': 'https://tldbi.com/zh',
      },
    },
  }
}
