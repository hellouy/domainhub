/**
 * Spaceship 适配器
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 站点: https://www.spaceship.com（Hostinger 旗下）
 * 直连首页返回 403（Cloudflare），价格页为 JS SPA + 内部定价 BFF API。
 *
 * 采集方式：走 browser-worker 页面会话，批量调用定价 BFF：
 *   POST /gateway/api/v1/pricing-bff/price/getPrices
 *   （products 按 productSlug 请求 purchase/renewal，单请求最多 65 个 product）
 * 用自定义 extract 脚本在页面上下文内分块（60/批）重放该接口，
 * 返回 [{ tld, register, renew, transfer }]，其中 transfer 槽复用为
 * 促销价（regularPrice > price 时），适配器 parse 阶段转成 promotionPrice。
 */
import { defineAdapter } from "@/packages/adapter-sdk"

/** 支持售卖的 TLD 清单（源自 revved tld_score，2026-10-08 快照，可随价格页刷新） */
const TLD_LIST = ["ac","academy","accountant","accountants","actor","ad","adult","ae.org","africa","agency","ai","airforce","apartments","app","archi","army","art","asia","associates","attorney","auction","audio","auto","autos","baby","band","bar","barcelona","bargains","beauty","beer","berlin","best","bet","bid","bike","bingo","bio","biz","black","blackfriday","blog","blue","boats","bond","boo","boston","bot","boutique","br.com","broker","build","builders","business","buzz","bz","ca","cab","cafe","cam","camera","camp","capital","car","cards","care","careers","cars","casa","cash","casino","cat","catering","cc","center","ceo","cfd","ch","channel","charity","chat","cheap","christmas","church","city","claims","cleaning","click","clinic","clothing","cloud","club","cm","cn","cn.com","co","co.bz","co.com","co.im","co.in","co.uk","coach","codes","coffee","college","com","com.au","com.co","com.de","com.es","com.im","com.mx","com.pe","com.ph","com.se","com.sg","com.vc","community","company","computer","condos","construction","consulting","contact","contractors","cooking","cool","country","coupons","courses","credit","creditcard","cricket","cruises","cv","cx","cymru","cyou","dad","dance","date","dating","day","de","de.com","deal","dealer","deals","degree","delivery","democrat","dental","dentist","desi","design","dev","diamonds","diet","digital","direct","directory","discount","diy","doctor","dog","domains","download","e2etestcpp","e2etestendswith","e2etestgeo","e2etestkeyword","earth","eco","education","email","energy","engineer","engineering","enterprises","equipment","es","esq","estate","eu","eu.com","events","exchange","expert","exposed","express","fail","faith","family","fan","fans","farm","fashion","fast","feedback","film","finance","financial","fish","fishing","fit","fitness","flights","florist","flowers","fm","foo","food","football","forex","forsale","forum","foundation","fr","free","fun","fund","furniture","futbol","fyi","gallery","game","games","garden","gay","gb.net","gdn","gg","gift","gifts","gives","giving","glass","global","gmbh","gold","golf","gr.com","graphics","gratis","green","gripe","group","guide","guitars","guru","hair","hamburg","haus","health","healthcare","help","hiphop","hockey","holdings","holiday","homes","horse","hospital","host","hosting","hot","hounds","house","how","hu.net","icu","id","im","immo","immobilien","in","in.net","inc","industries","info","ing","ink","institute","insure","international","investments","io","irish","is","it.com","jetzt","jewelry","jp.net","jpn.com","juegos","kaufen","kids","kim","kitchen","kiwi","krd","kyoto","la","land","lat","latino","law","lawyer","lease","legal","lgbt","li","life","lifestyle","lighting","limited","limo","link","live","living","llc","loan","loans","locker","lol","london","love","ltd","ltda","maison","makeup","management","market","marketing","markets","mba","me","me.uk","media","melbourne","meme","memorial","men","menu","mex.com","miami","mobi","mobile","moda","moe","mom","money","monster","mortgage","motorcycles","mov","movie","music","mx","my","nagoya","name","navy","net","net.au","net.im","net.pe","net.ph","net.vc","network","new","news","nexus","ngo","ninja","nl","nom.es","now","nu","nyc","observer","okinawa","one","ong","onl","online","org","org.au","org.es","org.im","org.mx","org.pe","org.ph","org.uk","org.vc","osaka","page","paris","partners","parts","party","pe","pet","ph","phd","photo","photography","photos","pics","pictures","pink","pizza","place","plumbing","plus","poker","porn","press","pro","productions","prof","promo","properties","property","protection","pub","pw","qatestcpp","qatestkeyword","quest","racing","realty","recipes","red","rehab","reise","reisen","rent","rentals","repair","report","republican","rest","restaurant","review","reviews","rip","rocks","rodeo","rsvp","ru.com","run","ryukyu","sa.com","sale","salon","sarl","sbs","school","schule","science","se.net","security","services","sex","sexy","sg","sh","shiksha","shoes","shop","shopping","show","si","singles","site","ski","skin","so","soccer","social","software","solar","solutions","soy","space","spot","storage","store","stream","studio","study","style","sucks","supplies","supply","support","surf","surgery","sydney","systems","talk","tattoo","tax","taxi","team","tech","technology","tel","tennis","theater","theatre","tickets","tienda","tips","tires","to","today","tokyo","tools","top","tours","town","toys","trade","trading","training","travel","tube","tv","uk","uk.com","uk.net","university","uno","us","us.com","us.org","vacations","vana","vc","vegas","ventures","vet","viajes","video","villas","vin","vip","vision","vodka","vote","voting","voto","voyage","wales","watch","webcam","website","wedding","wiki","win","wine","work","works","world","ws","wtf","xn--3ds443g","xn--6frz82g","xxx","xyz","yachts","yoga","yokohama","you","za.com","zip","zone"]

/** 价格页（建立会话后 API 需同源 fetch，cookie 自动携带） */
const PRICING_URL = "https://www.spaceship.com/domain-search/?tab=pricing"
const PRICE_API = "https://www.spaceship.com/gateway/api/v1/pricing-bff/price/getPrices"

/** 页面上下文内执行的提取脚本：分块重放 getPrices 并汇总 */
function buildScript(): string {
  const list = JSON.stringify(TLD_LIST)
  return `(() => {
  const TLD_LIST = ${list}
  const BATCH = 60
  const URL = ${JSON.stringify(PRICE_API)}
  const buildBody = (tlds) => ({
    currencies: ["USD"],
    includeFields: ["components","modifiers","params","discount","pricePerPeriod","outputValues","reducers"],
    includeBasePrice: true,
    products: tlds.map((t) => ({
      priceTypes: ["purchase","renewal"],
      product: { productSlug: t, plan: { pricingPlanParams: { transfer: 1, sld: "spaceship-query1" }, pricingPlanSlug: "regular", period: "P1Y" } },
    })),
  })
  const postBatch = async (tlds) => {
    const r = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody(tlds)) })
    if (!r.ok) throw new Error("HTTP " + r.status)
    return r.json()
  }
  return (async () => {
    const out = []
    for (let i = 0; i < TLD_LIST.length; i += BATCH) {
      const chunk = TLD_LIST.slice(i, i + BATCH)
      let data
      try { data = await postBatch(chunk) } catch (e) { continue }
      const products = data?.products ?? []
      for (const p of products) {
        const slug = p?.product?.productSlug
        if (!slug) continue
        const prices = p?.prices ?? []
        const purchase = prices.find((x) => x.priceType === "purchase")
        const renewal = prices.find((x) => x.priceType === "renewal")
        const reg = Number(purchase?.total?.USD?.price?.amount)
        const regRegular = Number(purchase?.total?.USD?.regularPrice?.amount)
        const renew = Number(renewal?.total?.USD?.price?.amount)
        const renewRegular = Number(renewal?.total?.USD?.regularPrice?.amount)
        const standard = regRegular > 0 ? regRegular : reg
        const promo = reg > 0 && standard > 0 && reg < standard ? reg : null
        out.push({ tld: slug, register: standard > 0 ? standard : null, renew: renew > 0 ? renew : renewRegular > 0 ? renewRegular : null, transfer: promo })
      }
    }
    return JSON.stringify(out)
  })()
})()`
}

export const spaceshipAdapter = defineAdapter({
  slug: "spaceship",
  name: "Spaceship",
  website: "https://www.spaceship.com",
  version: "1.0.0",
  parserVersion: "1.0.0",
  owner: "Data Team",
  currency: "USD",
  priority: 60,
  capabilities: { registration: true, renewal: true, transfer: true, supportedCurrencies: ["USD"] },
  rateLimit: { concurrency: 1, rpm: 8, retries: 2, timeoutMs: 180_000 },
  strategies: [
    {
      type: "playwright",
      url: PRICING_URL,
      async fetch(ctx) {
        const base = process.env.BROWSER_SERVICE_URL ?? "http://127.0.0.1:8840"
        const token = process.env.BROWSER_SERVICE_TOKEN ?? ""
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
        let extracted: unknown[] | null = null
        let lastErr = ""
        // Spaceship 对高频浏览器请求有 Cloudflare 限流，page.goto 偶发 60s 超时；重试兜底
        for (let attempt = 0; attempt < 3 && extracted === null; attempt++) {
          if (attempt > 0) await sleep(8_000)
          const res = await ctx.fetch(`${base}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({
              url: PRICING_URL,
              extract: "extract-json",
              scrollToBottom: false,
              script: buildScript(),
            }),
          })
          try {
            const data = (await res.json()) as { ok?: boolean; extracted?: unknown[]; error?: string }
            if (data.ok && Array.isArray(data.extracted) && data.extracted.length > 0) extracted = data.extracted
            else lastErr = data.error ?? `HTTP ${res.status}（命中为空）`
          } catch {
            lastErr = `HTTP ${res.status}`
          }
        }
        if (extracted === null) throw new Error(lastErr || "浏览器渲染失败")
        return JSON.stringify(extracted)
      },
      parse(raw) {
        const rows = JSON.parse(raw) as Array<{
          tld?: string
          registerPrice?: number | null
          renewPrice?: number | null
          transferPrice?: number | null
        }>
        const out = rows
          .filter((r) => r.tld)
          .map((r) => {
            const tld = r.tld!.toLowerCase().replace(/^\./, "")
            const register = r.registerPrice ?? null
            const renew = r.renewPrice ?? null
            const promo = r.transferPrice ?? null
            const price: {
              tld: string
              currency: string
              registerPrice: number | null
              renewPrice: number | null
              promotionPrice: number | null
            } = {
              tld,
              currency: "USD",
              registerPrice: register,
              renewPrice: renew,
              promotionPrice: promo,
            }
            return price
          })
          .filter((p) => p.registerPrice != null || p.renewPrice != null || p.promotionPrice != null)
        if (out.length === 0) throw new Error("spaceship 定价接口返回为空")
        return out
      },
    },
  ],
})
