"use client"

import { useLocale } from "@/components/providers"
import { Copy, Share2, Check } from "lucide-react"
import { useState } from "react"

export function ShareSection() {
  const { t, locale } = useLocale()
  const [copied, setCopied] = useState(false)
  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://tldbi.com"

  const shareLinks = [
    {
      name: "Twitter",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(t("share.twitter") || "Check out tldbi.com - Compare domain prices globally!")}&hashtags=domain,tld,compare`,
      color: "hover:text-blue-400",
    },
    {
      name: "LinkedIn",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`,
      color: "hover:text-blue-600",
    },
    {
      name: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
      color: "hover:text-blue-700",
    },
    {
      name: "WeChat",
      url: `#`,
      color: "hover:text-green-500",
      onClick: () => alert(t("share.wechat_scan") || "Scan with WeChat to share"),
    },
  ]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Share2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{t("share.title") || "Share tldbi.com"}</h3>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (link.onClick) {
                e.preventDefault()
                link.onClick()
              }
            }}
            className={`inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary ${link.color}`}
          >
            {link.name}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
        <input
          type="text"
          value={currentUrl}
          readOnly
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-primary/10 hover:text-primary"
          title={t("share.copy") || "Copy link"}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
