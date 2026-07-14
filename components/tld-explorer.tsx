"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowUpRight, ExternalLink, Search, X } from "lucide-react"
import { convertAmount } from "@/lib/format"
import { cn, normalizeUrl } from "@/lib/utils"
import { useCurrency, useLocale } from "@/components/providers"
import type { DictKey } from "@/lib/i18n"

export type ExplorerTld = {
  tld: string
  type: string
  isPopular: boolean
  minRegister: string | null
  registrarCount: number
}

type ApiPrice = {
  registrar: string
  registrarName: string
  currency: string
  registerPrice: number | null
  renewPrice: number | null
  transferPrice: number | null
  sourceUrl: string | null
}

const TYPE_TABS: { key: string; labelKey: DictKey }[] = [
  { key: "popular", labelKey: "explorer.tab.popular" },
  { key: "all", labelKey: "explorer.tab.all" },
  { key: "gTLD", labelKey: "explorer.tab.gtld" },
  { key: "ccTLD", labelKey: "explorer.tab.cctld" },
  { key: "newG", labelKey: "explorer.tab.newg" },
]

const PAGE_SIZE = 48

/** 排序用 USD 折算：使用实时汇率(providers 提供),促销价(< $1)沉底避免误导 */
function toUsdSort(value: number | null, currency: string, rates: Record<string, number> | null) {
  if (value == null) return Number.POSITIVE_INFINITY
  const usd = convertAmount(value, currency, "USD", rates)
  return usd < 1 ? usd + 100000 : usd
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** 展开面板：就地加载该后缀的最低报价，无需跳页 */
function PricePanel({ tld, onClose }: { tld: string; onClose: () => void }) {
  const { t } = useLocale()
  const { money, rates } = useCurrency()
  const { data, isLoading } = useSWR<{ data: ApiPrice[] }>(
    `/api/v1/prices?tld=${encodeURIComponent(tld)}&limit=50`,
    fetcher,
    { revalidateOnFocus: false },
  )
  // 客户端按实时汇率折算 USD 升序，促销价与 null 沉底，取前 6
  const rows = useMemo(() => {
    const all = data?.data ?? []
    return [...all]
      .sort(
        (a, b) => toUsdSort(a.registerPrice, a.currency, rates) - toUsdSort(b.registerPrice, b.currency, rates),
      )
      .slice(0, 6)
  }, [data, rates])

  return (
    <div className="col-span-full border border-primary/40 bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-mono text-base font-semibold">
          .{tld}{" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{t("explorer.panel.lowest")}</span>
        </h3>
        <div className="flex items-center gap-3">
          <Link
            href={`/tld/${tld}`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("explorer.panel.full")}
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("explorer.panel.close")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label={t("explorer.panel.loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse bg-secondary" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("explorer.panel.noData")}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li
              key={r.registrar}
              className="flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <span
                className={cn(
                  "w-5 shrink-0 font-mono text-xs",
                  i === 0 ? "font-bold text-primary" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <Link
                href={`/registrars/${r.registrar}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
              >
                {r.registrarName}
              </Link>
              <span className="flex shrink-0 flex-col items-end">
                <span
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    i === 0 && "text-primary",
                  )}
                >
                  {money(r.registerPrice, r.currency)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t("explorer.panel.renew")} {money(r.renewPrice, r.currency)}
                </span>
              </span>
              {normalizeUrl(r.sourceUrl) ? (
                <a
                  href={normalizeUrl(r.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t("explorer.panel.visit")} ${r.registrarName}`}
                  className="shrink-0 text-muted-foreground hover:text-primary"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              ) : (
                <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/30" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * TldExplorer —— 首页后缀浏览器。
 * 筛选 + 搜索 + 点击就地展开价格，一次点击看到报价，零页面跳转。
 */
export function TldExplorer({ tlds }: { tlds: ExplorerTld[] }) {
  const { t } = useLocale()
  const { money } = useCurrency()
  const [tab, setTab] = useState("popular")
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\.+/, "")
    let list = tlds
    if (q) {
      // 搜索优先级：前缀匹配 > 包含匹配
      const starts = list.filter((t) => t.tld.startsWith(q))
      const contains = list.filter((t) => !t.tld.startsWith(q) && t.tld.includes(q))
      return [...starts, ...contains]
    }
    if (tab === "popular") list = list.filter((t) => t.isPopular)
    else if (tab !== "all") list = list.filter((t) => t.type === tab)
    return list
  }, [tlds, tab, query])

  const shown = filtered.slice(0, visible)

  function selectTab(key: string) {
    setTab(key)
    setQuery("")
    setExpanded(null)
    setVisible(PAGE_SIZE)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选栏：移动端可横向滚动 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="后缀分类"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0"
        >
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
              setExpanded(null)
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

      <p className="text-xs text-muted-foreground">
        {filtered.length} {t("explorer.hint")}
      </p>

      {/* chip 网格：点击就地展开 */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {shown.map((t) => (
          <div key={t.tld} className="contents">
            <button
              type="button"
              onClick={() => setExpanded(expanded === t.tld ? null : t.tld)}
              aria-expanded={expanded === t.tld}
              className={cn(
                "flex flex-col gap-0.5 border px-2 py-1.5 text-left transition-colors md:px-3 md:py-2",
                expanded === t.tld
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary hover:bg-accent",
              )}
            >
              <span className="truncate font-mono text-[13px] font-semibold md:text-sm">.{t.tld}</span>
              <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground md:text-xs">
                {t.minRegister != null ? money(t.minRegister, "USD") : "—"}
              </span>
            </button>
            {expanded === t.tld && <PricePanel tld={t.tld} onClose={() => setExpanded(null)} />}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("explorer.empty")}
        </p>
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
