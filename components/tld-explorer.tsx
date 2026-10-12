"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, Copy, ExternalLink, Search, Ticket, X } from "lucide-react"
import { convertAmount } from "@/lib/format"
import { getActivePromotionPrice } from "@/lib/promotion"
import { cn, normalizeUrl, withRegistrarReferral } from "@/lib/utils"
import { useCurrency, useLocale } from "@/components/providers"
import type { DictKey } from "@/lib/i18n"
import type { TldBestQuote } from "@/lib/db/queries"

export type ExplorerTld = TldBestQuote

/** 优惠码与促销同生命周期：促销已过期则不再展示优惠码 */
function activePromoCode(q: ExplorerTld) {
  const code = q.promoCode?.trim()
  if (!code) return null
  if (q.promotionEndsAt != null) {
    const end = new Date(q.promotionEndsAt).getTime()
    if (!Number.isFinite(end) || end < Date.now()) return null
  }
  return code
}

/** 与服务端选取最低价的 SQL 同口径：生效中的促销价优先 */
function effectiveRegister(q: ExplorerTld) {
  const promo = getActivePromotionPrice(q.registerPrice, q.promotionPrice, q.promotionEndsAt)
  const value = promo ?? q.registerPrice
  return { value: value == null ? null : Number(value), isPromo: promo != null }
}

function CouponChip({ code }: { code: string }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`${t("deals.copyCode")} ${code}`}
      className={cn(
        "relative z-10 inline-flex h-7 max-w-full items-center gap-1.5 border border-dashed px-2 font-mono text-xs font-semibold transition-colors",
        copied
          ? "border-primary bg-primary text-primary-foreground"
          : "border-primary bg-primary/10 text-primary hover:bg-primary/20",
      )}
    >
      <Ticket aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate tracking-wide">{code}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 shrink-0" />
      ) : (
        <Copy aria-hidden="true" className="size-3 shrink-0 opacity-70" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? t("deals.copied") : ""}
      </span>
    </button>
  )
}

const TYPE_TABS: { key: string; labelKey: DictKey }[] = [
  { key: "popular", labelKey: "explorer.tab.popular" },
  { key: "all", labelKey: "explorer.tab.all" },
  { key: "gTLD", labelKey: "explorer.tab.gtld" },
  { key: "ccTLD", labelKey: "explorer.tab.cctld" },
  { key: "newG", labelKey: "explorer.tab.newg" },
]

const PAGE_SIZE = 30

function QuoteRow({ q }: { q: ExplorerTld }) {
  const { t } = useLocale()
  const { money } = useCurrency()
  const eff = effectiveRegister(q)
  const code = activePromoCode(q)
  const savingPct =
    eff.isPromo && q.registerPrice && eff.value != null
      ? Math.round((1 - eff.value / Number(q.registerPrice)) * 100)
      : null
  const buyUrl = withRegistrarReferral(normalizeUrl(q.sourceUrl), "home_tld_list")
  const hasDeal = eff.isPromo || code != null

  return (
    <li className="tap-row group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-accent md:grid-cols-[8rem_10rem_minmax(0,1fr)_9rem_6rem_2.75rem] md:gap-x-4 md:px-4">
      {/* 后缀 + 注册商（移动端两行） */}
      <div className="flex min-w-0 flex-col gap-0.5 md:contents">
        <Link
          href={`/tld/${q.tld}`}
          className="tap-row__link font-mono text-base font-semibold after:absolute after:inset-0 after:content-[''] md:text-lg"
        >
          .{q.tld}
        </Link>
        <span className="truncate text-xs text-muted-foreground md:hidden">
          {q.registrarName ?? "—"} · {q.registrarCount} {t("explorer.registrars")}
        </span>
      </div>

      {/* 价格：唯一的视觉重点 */}
      <div className="flex flex-col items-end md:order-none md:items-start">
        <span
          className={cn(
            "font-mono text-lg font-bold tabular-nums leading-tight",
            hasDeal ? "text-primary" : "text-foreground",
          )}
        >
          {eff.isPromo && <span className="sr-only">{t("promo.label")} </span>}
          {eff.value != null ? money(eff.value, q.currency ?? "USD") : "—"}
        </span>
        {eff.isPromo && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="sr-only">{t("deals.regularPrice")} </span>
            <s className="font-mono tabular-nums">{money(q.registerPrice, q.currency ?? "USD")}</s>
            {savingPct != null && savingPct > 0 && (
              <span className="bg-primary px-1 font-mono text-[10px] font-semibold leading-4 text-primary-foreground">
                -{savingPct}%
              </span>
            )}
          </span>
        )}
      </div>

      {/* 桌面端：注册商列 */}
      <span className="hidden min-w-0 flex-col md:flex">
        <span className="truncate text-sm font-medium">{q.registrarName ?? "—"}</span>
        <span className="text-xs text-muted-foreground">
          {q.registrarCount} {t("explorer.registrars")}
        </span>
      </span>

      {/* 优惠码：移动端独占一行，醒目可复制 */}
      <div className={cn("col-span-2 md:col-span-1", !code && "hidden md:block")}>
        {code ? <CouponChip code={code} /> : <span className="text-sm text-muted-foreground/50">—</span>}
      </div>

      {/* 桌面端：续费 + 去购买 */}
      <span className="hidden font-mono text-sm tabular-nums text-muted-foreground md:block">
        {q.renewPrice != null ? money(q.renewPrice, q.currency ?? "USD") : "—"}
      </span>
      <span className="hidden justify-end md:flex">
        {buyUrl ? (
          <a
            href={buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("explorer.panel.visit")} ${q.registrarName ?? ""}`}
            className="relative z-10 flex size-9 items-center justify-center text-muted-foreground hover:text-primary"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        ) : (
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
      </span>
    </li>
  )
}

/**
 * TldExplorer —— 首页后缀比价列表。
 * 一行一个后缀：最低首年价 + 注册商 + 优惠码，点击整行进入完整比价页。
 */
export function TldExplorer({ tlds }: { tlds: ExplorerTld[] }) {
  const { t } = useLocale()
  const { rates } = useCurrency()
  const [tab, setTab] = useState("popular")
  const [sort, setSort] = useState<"popular" | "price">("popular")
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\.+/, "")
    let list = tlds
    if (q) {
      const starts = list.filter((x) => x.tld.startsWith(q))
      const contains = list.filter((x) => !x.tld.startsWith(q) && x.tld.includes(q))
      list = [...starts, ...contains]
    } else if (tab === "popular") list = list.filter((x) => x.isPopular)
    else if (tab !== "all") list = list.filter((x) => x.type === tab)

    if (sort === "price") {
      const usd = (x: ExplorerTld) => {
        const v = effectiveRegister(x).value
        return v == null ? Number.POSITIVE_INFINITY : convertAmount(v, x.currency ?? "USD", "USD", rates)
      }
      list = [...list].sort((a, b) => usd(a) - usd(b))
    }
    return list
  }, [tlds, tab, sort, query, rates])

  const shown = filtered.slice(0, visible)

  function selectTab(key: string) {
    setTab(key)
    setQuery("")
    setVisible(PAGE_SIZE)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="后缀分类" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
          {TYPE_TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              role="tab"
              aria-selected={tab === tabItem.key && !query}
              onClick={() => selectTab(tabItem.key)}
              className={cn(
                "shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === tabItem.key && !query
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 focus-within:border-primary md:w-64">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder={t("explorer.filter")}
            aria-label={t("explorer.filter")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空筛选"
              className="text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {t("explorer.hint")}
        </p>
        <div className="flex shrink-0 border border-border text-xs" role="group" aria-label="排序">
          {(["popular", "price"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
              className={cn(
                "px-2.5 py-1 font-medium transition-colors",
                sort === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(s === "popular" ? "explorer.sort.popular" : "explorer.sort.price")}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("explorer.empty")}
        </p>
      ) : (
        <div className="border border-border bg-card">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[8rem_10rem_minmax(0,1fr)_9rem_6rem_2.75rem] gap-x-4 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:grid"
          >
            <span>{t("explorer.col.tld")}</span>
            <span>{t("explorer.col.price")}</span>
            <span>{t("explorer.col.registrar")}</span>
            <span>{t("explorer.col.coupon")}</span>
            <span>{t("explorer.col.renew")}</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {shown.map((q) => (
              <QuoteRow key={q.tld} q={q} />
            ))}
          </ul>
        </div>
      )}

      {filtered.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE * 2)}
          className="mx-auto border border-border bg-card px-6 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
        >
          {t("explorer.showMore").replace("{n}", String(filtered.length - visible))}
        </button>
      )}
    </div>
  )
}
