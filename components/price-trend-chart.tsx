"use client"

import { useState } from "react"
import useSWR from "swr"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"

/**
 * 价格趋势图：调用 /api/v1/history/{tld} 展示某后缀的历史价格走势。
 * 支持 30d / 90d / 365d 三档区间切换。
 */

type RangeKey = "30d" | "90d" | "365d"

const RANGE_LABELS: Record<RangeKey, string> = {
  "30d": "30 天",
  "90d": "90 天",
  "365d": "1 年",
}

interface DayPoint {
  day: string
  lowest: string | null
  highest: string | null
  average: string | null
  changes: number
}

interface HistoryResponse {
  tld?: string
  range?: string
  days?: number
  totalChanges?: number
  data?: DayPoint[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PriceTrendChart({ tld }: { tld: string }) {
  const [range, setRange] = useState<RangeKey>("90d")
  const { data, isLoading } = useSWR<HistoryResponse>(
    `/api/v1/history/${encodeURIComponent(tld)}?range=${range}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  // 转为数值供 recharts 使用
  const points = (data?.data ?? []).map((d) => ({
    day: d.day,
    lowest: d.lowest != null ? Number.parseFloat(d.lowest) : null,
    average: d.average != null ? Number.parseFloat(d.average) : null,
    highest: d.highest != null ? Number.parseFloat(d.highest) : null,
  }))
  const hasData = points.length >= 2

  return (
    <section aria-labelledby="price-trend" className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h2 id="price-trend" className="text-xl font-bold tracking-tight">
          价格趋势
        </h2>
        <div className="flex items-center gap-1" role="group" aria-label="时间区间">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                range === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-border bg-card p-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中…</div>
        ) : !hasData ? (
          <div className="flex h-64 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-muted-foreground">历史数据积累中</p>
            <p className="text-xs text-muted-foreground">
              每次采集到价格变动都会记录历史，随时间推移趋势图会更完整
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v: number) => `$${v}`}
                  width={56}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      average: "平均注册价",
                      lowest: "最低注册价",
                      highest: "最高注册价",
                    }
                    const num = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
                    const display = Number.isFinite(num) ? `$${num.toFixed(2)}` : "—"
                    return [display, labels[String(name)] ?? String(name)]
                  }}
                  labelFormatter={(label) => `日期：${String(label)}`}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  name="average"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="lowest"
                  name="lowest"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        实线为全网平均注册价，虚线为最低注册价。数据来自每日采集的价格变动记录，仅在价格发生变化时记账。
      </p>
    </section>
  )
}
