"use client"

import Link from "next/link"
import { useLocale } from "@/components/providers"

export type BadgeItem = {
  id: string
  name: string
  url: string
  icon: React.ReactNode
  label: string
}

const DEFAULT_BADGES: BadgeItem[] = [
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com/hellouy/domainhub",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    label: "Star on GitHub",
  },
  {
    id: "producthunt",
    name: "Product Hunt",
    url: "https://www.producthunt.com/products/tldbi",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm4.245 13.02c0 1.695-.93 2.83-2.575 2.83h-3.07V8.15h3.07c1.645 0 2.575 1.135 2.575 2.83v2.04zm-2.375-4.06h-1.695v3.07h1.695v-3.07z" />
      </svg>
    ),
    label: "View on Product Hunt",
  },
  {
    id: "reddit",
    name: "Reddit",
    url: "https://reddit.com/r/webdev",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.385 4.859-7.181 4.859-3.796 0-7.182-2.165-7.182-4.859a3.5 3.5 0 0 1 .093-.749 1.747 1.747 0 0 1-1.059-1.607c0-.968.79-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.53l.847-4.048c.057-.26.218-.464.464-.464.393 0 .73.255.822.643l2.322.653c.359-.454.922-.719 1.554-.719.968 0 1.754.786 1.754 1.754s-.786 1.754-1.754 1.754c-.618 0-1.146-.381-1.404-.931l-2.432-.766c-.397-.26-.905-.21-1.242.228-.143.248-.435.641-.835.641-.398 0-.662-.159-.921-.641l-1.646.335c.135.933 1.638 1.548 2.941 1.548.173 0 .349 0 .52-.033.864 1.905 2.778 3.35 4.923 3.35.675 0 1.325-.122 1.96-.346 1.268-.81 2.062-2.122 2.062-3.562 0-.881-.223-1.721-.607-2.528 1.074-1.125 1.77-2.638 1.77-4.274 0-.651-.086-1.3-.25-1.924z" />
      </svg>
    ),
    label: "Discuss on Reddit",
  },
]

export function SocialBadges({ items = DEFAULT_BADGES }: { items?: BadgeItem[] }) {
  const { t } = useLocale()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((badge) => (
        <Link
          key={badge.id}
          href={badge.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
          aria-label={badge.label}
        >
          <span className="text-muted-foreground group-hover:text-primary">{badge.icon}</span>
          <span className="hidden sm:inline">{badge.name}</span>
        </Link>
      ))}
    </div>
  )
}
