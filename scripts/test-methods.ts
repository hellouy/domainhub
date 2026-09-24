/**
 * 采集方法测试 —— 覆盖 4 种采集形态的端到端验证
 * ------------------------------------------------------------
 * 1. html 直采       : Asia 三家 SSR 表格注册商（xserver/value-domain/muumuu-domain）
 * 2. extract-json    : 浏览器 DOM 提取（本地测试页 index.html + 真实站 dynadot）
 * 3. xhr-json        : 本地测试页 xhr.html 捕获 /price.json（含 cookies 返回）
 * 4. api-fetch       : 本地测试页会话内重放 /price.json + 真实站 hostinger
 * 5. 反爬可迁移      : 受控反爬站（cookie+鉴权头校验，仿 hostinger 模式）——
 *    xhr-json 定位接口 + api-fetch 打通（scripts/protected-test-server.ts, 需手动起）
 *
 * 运行：npx tsx scripts/test-methods.ts   （需 BROWSER_SERVICE_URL=http://127.0.0.1:8840）
 */
import { executeStrategies } from "/workspace/packages/adapter-sdk/strategy-engine"
import { xserverAdapter, valueDomainAdapter, muumuuDomainAdapter } from "/workspace/adapters/table-registrars"
import { hostingerAdapter } from "/workspace/adapters/hostinger"
import { dynadotAdapter } from "/workspace/adapters/dynadot"

function makeCtx(slug: string) {
  return {
    registrarId: 0,
    slug,
    log: async (level: string, message: string) => console.log(`[${level}] ${message}`),
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    getCredential: async () => null,
    knownTlds: new Set<string>(),
    addRetry: () => {},
  } as never
}

const results: { method: string; slug: string; ok: boolean; count: number; ms: number; note: string }[] = []

async function run(method: string, slug: string, strategies: Parameters<typeof executeStrategies>[0], want: number) {
  const t = Date.now()
  try {
    const res = await executeStrategies(strategies, makeCtx(slug))
    const ok = res.rawPrices.length >= want
    results.push({ method, slug, ok, count: res.rawPrices.length, ms: Date.now() - t, note: `策略 ${res.strategy}` })
  } catch (err) {
    results.push({ method, slug, ok: false, count: 0, ms: Date.now() - t, note: (err as Error).message })
  }
}

async function main() {
  console.log("已注册: ", ["xserver", "value-domain", "muumuu-domain", "hostinger", "dynadot"].join(", "))

  // 1. html 直采（SSR 表格）
  await run("html", "xserver", xserverAdapter.definition.strategies, 100)
  await run("html", "value-domain", valueDomainAdapter.definition.strategies, 100)
  await run("html", "muumuu-domain", muumuuDomainAdapter.definition.strategies, 100)

  // 2. extract-json（浏览器 DOM 提取）
  await run(
    "extract-json",
    "local-table",
    [
      {
        type: "playwright" as const,
        url: "http://127.0.0.1:8899/index.html",
        browser: { extract: "extract-json" as const, waitFor: "#pricing-table", waitForTimeoutMs: 10_000, scrollToBottom: false },
      },
    ],
    1,
  )

  // 3. xhr-json（请求侧捕获 + cookies 返回）
  await run(
    "xhr-json",
    "local-xhr",
    [
      {
        type: "playwright" as const,
        url: "http://127.0.0.1:8899/xhr.html",
        browser: { extract: "xhr-json" as const, captureXhrFilter: ["price.json"], waitForTimeoutMs: 10_000, scrollToBottom: false },
        parse: async (raw: string) => {
          const list = JSON.parse(raw) as Array<{ url: string; body: string }>
          const hit = list.find((r) => r.url.includes("price.json"))
          if (!hit) throw new Error("未捕获 price.json")
          const rows = JSON.parse(hit.body).example.tlds as Array<{ tld: string; register: number; renew: number; transfer: number }>
          return rows.map((r) => ({ tld: r.tld, registerPrice: r.register, renewPrice: r.renew, transferPrice: r.transfer }))
        },
      },
    ],
    1,
  )

  // 4a. api-fetch（本地会话内重放）
  await run(
    "api-fetch",
    "local-api",
    [
      {
        type: "playwright" as const,
        url: "http://127.0.0.1:8899/xhr.html",
        browser: {
          extract: "api-fetch" as const,
          waitForTimeoutMs: 10_000,
          scrollToBottom: false,
          apiFetch: { url: "http://127.0.0.1:8899/price.json", method: "GET" },
        },
        parse: async (raw: string) => {
          const rows = JSON.parse(raw).example.tlds as Array<{ tld: string; register: number; renew: number; transfer: number }>
          return rows.map((r) => ({ tld: r.tld, registerPrice: r.register, renewPrice: r.renew, transferPrice: r.transfer }))
        },
      },
    ],
    1,
  )

  // 5a. 反爬可迁移：xhr-json 定位受控反爬接口（含请求模板/cookies）
  await run(
    "xhr-json",
    "protected-xhr",
    [
      {
        type: "playwright" as const,
        url: "http://127.0.0.1:8898/protected.html",
        browser: { extract: "xhr-json" as const, captureXhrFilter: ["protected-price"], waitForTimeoutMs: 10_000, scrollToBottom: false },
        parse: async (raw: string) => {
          const list = JSON.parse(raw) as Array<{ status: number; body: string }>
          const hit = list.find((r) => r.status === 200)
          if (!hit) throw new Error("受控反爬接口未被成功捕获")
          const rows = JSON.parse(hit.body).protected.tlds as Array<{ tld: string; register: number; renew: number; transfer: number }>
          return rows.map((r) => ({ tld: r.tld, registerPrice: r.register, renewPrice: r.renew, transferPrice: r.transfer }))
        },
      },
    ],
    1,
  )

  // 5b. 反爬可迁移：api-fetch 会话内打通受控反爬接口
  await run(
    "api-fetch",
    "protected-api",
    [
      {
        type: "playwright" as const,
        url: "http://127.0.0.1:8898/protected.html",
        browser: {
          extract: "api-fetch" as const,
          waitForTimeoutMs: 10_000,
          scrollToBottom: false,
          apiFetch: {
            url: "http://127.0.0.1:8898/protected-price.json",
            method: "GET",
            headers: { authorization: "Bearer protected-test", accept: "application/json" },
          },
        },
        parse: async (raw: string) => {
          const rows = JSON.parse(raw).protected.tlds as Array<{ tld: string; register: number; renew: number; transfer: number }>
          return rows.map((r) => ({ tld: r.tld, registerPrice: r.register, renewPrice: r.renew, transferPrice: r.transfer }))
        },
      },
    ],
    1,
  )

  // 4b. api-fetch（hostinger 真实站，全量）
  await run("api-fetch", "hostinger", hostingerAdapter.definition.strategies, 50)

  console.log("\n--- 方法谱系结果 ---")
  console.log("方法\t\t源\t\t状态\t条数\t耗时\t说明")
  for (const r of results) {
    console.log(`${r.method}\t${r.slug}\t${r.ok ? "PASS" : "FAIL"}\t${r.count}\t${r.ms}ms\t${r.note}`)
  }
  const passed = results.filter((r) => r.ok).length
  console.log(`\n汇总: ${passed}/${results.length} 通过`)
  process.exit(passed === results.length ? 0 : 1)
}

main()