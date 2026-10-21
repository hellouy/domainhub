# 注册商数据源清单与爬取经验书

> 提供方: Data Team · 更新: 2026-10-14
> 用途: 服务器接替采集更新工作时, 据此配置数据源与运行方式。

## 1. 采集链路总览

```
适配器(adapters/*.ts)
  → Adapter SDK 2.0 (packages/adapter-sdk)
    → 策略引擎: 按优先级自动降级
  → Validation (校验: 负价/币种/超值/缺续费)
  → Storage (createPriceSink / runCrawlWithSdk)
  → Postgres prices 表 (联合唯一 regexp: registrar_id + tld_id)
```

- 入口: `services/crawl` 的 `runCrawlWithSdk(registrarId, {trigger})` — 写库采集
- 命令行(服务器用): `npx tsx scripts/recrawl-browser-registrars.ts [--all | <slug...>]`
- 后台常驻服务: browser-worker(8840) 用于 playwright 渲染; 8090 聚合服务用于 anti-bot

## 2. 数据源策略分类(7 种, 按优先级)

| 策略 | 含义 | 是否需要外部服务 | 服务器可直跑 |
|---|---|---|---|
| `api` | 官方公开价格 API(JSON) | 无 | ✅ 开箱即用 |
| `json` | 静态/社区 JSON 端点 | 无 | ✅ 开箱即用 |
| `html` | 直接 fetch 页面解析 HTML 表格 | 无 | ✅ 开箱即用 |
| `xhr` | 站点内部 XHR/API 接口 | 无(个别需 cookie) | ✅ 开箱即用 |
| `embedded-json` | 页面内嵌 JSON | 无 | ✅ 开箱即用 |
| `playwright` | 无头浏览器渲染(页面 JS 加载价格) | 需 browser-worker(8840/8841) | ⚠️ 需部署 worker |
| `anti-bot` | FlareSolverr/Browserless 聚合反爬 | 需 8090 聚合服务 | ⚠️ 需平台服务 |

## 3. 全部注册商数据源清单(SDK 适配器)

### 3.1 api — 官方公开 API(最省服务)

| slug | URL | 说明 |
|---|---|---|
| porkbun | https://api.porkbun.com/api/json/v3/pricing/get | 全量 JSON, 911 TLD |
| namecheap | https://api.parse.bot/scraper/1343754a-086c-4c84-83b1-cc53e3f95f0c/list_tld_prices | Parse.bot 托管, X-API-Key 头, 571 TLD |
| ovhcloud | https://eu.api.ovh.com/v1/order/catalog/public/domain?ovhSubsidiary=FR | 941 TLD |
| openprovider | https://www.openprovider.com/api/pricing-data?currency=USD | 2069 TLD |
| inwx | https://www.inwx.com/api/v1/domain/all-prices | 2232 TLD |
| iwantmyname | https://iwantmyname.com/Prices-getPrices.html?ajax=1&limit=...&offset=... | 分页拉取 |
| gname | https://www.gname.com/request/get_price | 86 TLD |
| rebel | https://api.rebel.com/price/allTLDPrices/Rebel | 470 TLD |
| one | https://www.one.com/rest/tlds/{tld}/display-prices/?country=GB | 逐 TLD 拉取 |

### 3.2 json — 静态 JSON

| slug | URL | 说明 |
|---|---|---|
| cloudflare | https://cfdomainpricing.com/prices.json | 430 TLD |
| epik | https://registrar.epik.com/api/load-200-plus-prices | 705 TLD |
| joker | https://joker.com/api/v1/price/list | 598 TLD |
| nicnames | https://nicnames.com/api/domains/registrar-prices | 600 TLD |
| tierra | https://registry.tierra.net:8443/pricingData | 359 TLD |

### 3.3 html — SSR 直连解析(占比最高)

| slug | URL | 说明 |
|---|---|---|
| activedomains | https://active.domains/domains/ | 107 TLD |
| atakdomain | https://atakdomain.com/domain-fiyatlari | 956 TLD |
| alldomains-uz | https://alldomains.uz/en/prices | 413 TLD |
| connectreseller | https://www.connectreseller.com/domain-prices/ | 650 TLD |
| cosmotown | https://cosmotown.com/pricing | 249 TLD (html 优先) |
| cpi | https://www.cpi.ad.jp/domain/ | 13 TLD JPY |
| domaincostclub | https://www.domaincostclub.com/pricing.dhtml | 456 TLD |
| dotology | https://www.dotology.com/pricing | 334 TLD |
| dotwee | https://dotwee.com/pricing | 461 TLD |
| easyspace | https://www.easyspace.com/pricelist | 539 TLD |
| eurodns | https://www.eurodns.com/domain-extensions | 140 TLD |
| forpsi | https://www.forpsi.com/domain/ | 243 TLD |
| gandi | https://www.gandi.net/en/domain | 53 TLD (SSR 曾缩至 10 行) |
| gatehills | https://gatehills.com/domain-prices-transparent-registration-renewal | 435 TLD |
| gzidc | https://gzidc.com/domain_new.php | 10 TLD |
| hostafrica | https://hostafrica.co.za/domains | 10 TLD |
| hostripples | https://hostripples.in/domain-registration.php | 24 TLD |
| imena | https://imena.ua/domains/prices | 361 TLD |
| interserver | https://www.interserver.net/domains/ | 503 TLD |
| istanco | https://istanco.com/domain/pricing | 48 TLD |
| kouming | https://kouming.com/domain/price | 397 TLD |
| lws | https://lws.net/domain-pricing | 301 TLD |
| mchost | https://mchost.ru/services/domains/ | 378 TLD |
| metaname | https://metaname.net/public/pricing | 92 TLD |
| namegear | https://namegear.co/domain/extensions/ | 17 TLD |
| netzone | https://www.netzone.ch/de/domainregistrierung | 1019 TLD |
| onlydomains | https://www.onlydomains.com/domains/pricing | 878 TLD |
| register4less | https://register4less.com/info/pricing | 420 TLD |
| rumahweb | https://www.rumahweb.com/domain | 386 TLD |
| stardomain | https://star-domain.jp/price | 52 TLD |
| truehost | https://truehost.co.ke/domains/ | 515 TLD KES (table-adapter) |
| truehost-cloud | https://truehost.com/cloud/index.php?rp=/domain/pricing | 560 TLD (table-adapter) |
| hover | https://www.hover.com/domains | (table-adapter, 现 6 条) |
| directnic | https://www.directnic.com/pricing | 535 TLD |
| dreamhost | https://www.dreamhost.com/domains/pricing/ | 319 TLD |
| juming | https://www.juming.com/price.htm | 126 TLD CNY |
| blacknight | https://www.blacknight.com/domain-extensions/ | 157 TLD EUR |
| xserver | https://www.xserver.ne.jp/domain/ | 275 TLD JPY |
| value-domain | https://www.value-domain.com/domain/price/ | 480 TLD JPY (table-adapter) |
| muumuu-domain | https://muumuu-domain.com/domain/price/ | 418 TLD JPY |
| loopia | https://www.loopia.se/domannamn/ | 47 TLD SEK |
| domeneshop | https://domene.shop/pricelist | 17 TLD NOK |
| lws | https://lws.net/domain-pricing | 301 TLD EUR |
| fabulous | https://fabulous.com/pricing | 500 TLD |
| danesco | https://danesconames.com/prices | 40 TLD |
| barbero | https://barbero.co.uk/price-list | 10 TLD EUR |
| hostingkr | https://www.hosting.kr/domain | 12 TLD KRW |
| exabytes | https://www.exabytes.my/domains/domain-name-search | 62 TLD MYR |
| lcn | https://www.lcn.com/domain-names | 15 TLD GBP |
| onamae | https://www.onamae.com/service/d-price/ | 443 TLD JPY |
| networksolutions | https://www.networksolutions.com/domains/domain-name-pricing | 32 TLD |
| ultahost | https://ultahost.com/en/domains/pricing | 535 TLD |
| value-domain | https://www.value-domain.com/domain/price/index.html | 480 TLD |
| vsys | https://vsys.name/pricing | 385 TLD |
| whc | https://whc.ca/domain-names/new | 440 TLD |
| whogohost | https://www.whogohost.com/domain/ | 443 TLD |
| active24 | https://www.active24.cz/domeny/ | 10 TLD |
| osir | https://osir.com/en/pricing/ | 17 TLD (table-adapter) |
| icdsoft | https://icdsoft.com/en/domains | 30 TLD (table-adapter) |
| regtons | https://regtons.com/en/domains | 1092 TLD (table-adapter) |
| quyu | https://www.quyu.net/domainpricelist.php | 950 TLD (table-adapter) |
| 22cn | https://www.22.cn/domain/price/ | 112 TLD (table-adapter) |
| idwebhost | https://idwebhost.com/domain/ (规范页面) | html |
| keliweb | https://www.keliweb.com/domains/ | HTML |
| milesweb | https://www.milesweb.com/domain/ | HTML |
| ukrnames | https://www.ukrnames.com/ | HTML |

### 3.4 xhr / embedded-json — 站点内部接口

| slug | URL | 说明 |
|---|---|---|
| dynadot | https://www.dynadot.com/dynadot-vue-api/...domain-search?command=get_current_list | 820 TLD |
| hostinger | https://www.hostinger.com/api-proxy/api/domain/tlds-pricing | POST, 需授权头 |
| hostpoint | https://www.hostpoint.ch/api/domain-price-api.php?lang=en | 1165 TLD |
| wpx | https://wpx.net/domain-registration/ (嵌入式 JSON) | 40 TLD |
| onecom | https://www.one.com/en/domain/domain-prices (嵌入式) | (inactive) |

### 3.5 playwright 主策略 — 必须浏览器渲染(依赖 browser-worker)

> 运行时策略第一优先级即 playwright, 服务器直连 HTML 拿不到数据, 必须部署 worker。

| slug | URL |
|---|---|
| namecom | https://www.name.com/pricing |
| spaceship | https://www.spaceship.com/domain-search/ |
| 101domain | https://www.101domain.com/pricing.htm |
| cloudns | https://www.cloudns.net/domains/ |
| pskz | https://www.ps.kz/domains（直连 122KB 无表格, 必走渲染; 汇率计算 `9 590 тг/жыл`） |
| westcn | https://www.west.cn/web/price/domainpricelist |
| afrihost | https://www.afrihost.com/domains |
| julyname | https://julyname.com/price.htm |
| 59cn | https://ym.longming.com/pricing |
| zwcn | https://zw.cn/Domain/domainprice.html |
| aruba | https://www.aruba.it/listino-domini.aspx (playwright, html 降级) |

### 3.6 anti-bot 主策略 — 需 8090 聚合服务

| slug | URL |
|---|---|
| ccireg | https://ccireg.com/Pricing/index.html |
| pavietnam | https://www.pavietnam.vn/vn/ten-mien-bang-gia.html |
| ueepa | https://www.ueepa.com.br/dominios/tabela-de-precos/ |
| godaddy | https://se.godaddy.com/domains/discount-domain-club (private-api, anti-bot 降级) |

### 3.6b 混合型: html + playwright/anti-bot 降级(直连优先, 降级才需外部服务)

| slug | URL | 降级 |
|---|---|---|
| namesilo | https://www.namesilo.com/pricing | anti-bot → playwright |
| networksolutions | https://www.networksolutions.com/domains/domain-name-pricing | playwright |
| cosmotown | https://cosmotown.com/pricing | anti-bot → playwright |
| dynadot | https://www.dynadot.com/... (xhr 优先) | playwright x2 |
| hostinger | https://www.hostinger.com/api-proxy/... (xhr 优先) | playwright |
| juming | https://www.juming.com/price.htm | playwright |
| onamae | https://www.onamae.com/service/d-price/ | playwright |
| exabytes | https://www.exabytes.my/domains/domain-name-search | playwright |
| hostingkr | https://www.hosting.kr/domain | playwright |
| aliyun | https://wanwang.aliyun.com/help/price.html | anti-bot |
| krystal | https://krystal.uk/domains | anti-bot |
| afriregister | https://www.afriregister.com/... | anti-bot |

### 3.7 private-api — 需贵商 API Key(等凭证, 默认 inactive)

| slug | 说明 |
|---|---|
| godaddy | 官方 priv-API |
| enom | 批发 API(不采, 用户规则) |
| infomaniak | 官方 API(等 Key) |
| netim | 官方 API(等 Key) |
| resellerclub | 批发 API(不采) |
| namecheap | 已切 Parse.bot(不再走官方 XML/priv-API) |

## 4. 服务器部署所需环境变量

`.env.local`(服务器新建):
```
DATABASE_URL="postgresql://<user>:<pass>@<host>.pooler.supabase.com:6543/postgres?uselibpqcompat=true&sslmode=require"
PARSE_BOT_API_KEY=<pmx_...>                 # namecheap 专用
ADMIN_PASSWORD=<...>
# playwright 型注册商用(可选, 不配则仅直连策略生效):
BROWSER_SERVICE_URL=http://127.0.0.1:8840
BROWSER_SERVICE_TOKEN=<worker token>
# anti-bot 型用(8090 服务恢复后):
CRAWL_SERVICE_URL=http://<host>:8090
CRAWL_SERVICE_TOKEN=<...>
# 促销码采集(可选):
SEARXNG_BASE_URL=...
SEARXNG_TOKEN=...
```

## 5b. 促销码采集现状与运行方式(2026-10-21 调研)

`scripts/collect-promo-codes.ts` 独立于价格采集运行, 将注册商官方促销码写入 `prices.promo_codes`/`promo_code`, 结构化源还会写 `promotion_price`。

```bash
# 指定多家(推荐: 只跑已知有促销页的源, 全量 100 家约 6-7 小时)
npx tsx --env-file=.env.local scripts/collect-promo-codes.ts spaceship namecheap inwx
```

### 各源现状(批量调研结论)

| 源 | 状态 | 说明 |
|---|---|---|
| spaceship | ✅ 结构化 | `/zh/promos/` 官方促销页, TLD→码→促销价(extractStructuredDeals), 已验证落库 |
| namecheap | ✅ 站级码 | `/promos/` 页面 JSON `coupons` 字段为当期码(T0 通道优先), 主码 SPRNGDMNS 等; 产品码(托管/VPS/SSL)由 PRODUCT_CODES 过滤 |
| inwx | ✅ 通用 | `/en/offer` JS 注入价, 仅抓到码(L26), 无结构化价 |
| ovhcloud | ⚠️ | 域名价格页无促销结构 |
| namesilo/networksolutions/hostinger/dreamhost | ⚠️ | URL 存在但反爬占位页(Service Disruption/Error/Go Online), 重试可成 |
| gandi/101domain/porkbun/dynadot/namecom/onlydomains | ❌ | 官方促销页已下线/改版(404), 已从 KNOWN_PROMO_URLS 移除, 走 SearXNG 发现 + common paths 探测 |

### 关键实现要点

1. **KNOWN_PROMO_URLS 只保留有效 URL**, 失效的走 SearXNG + common paths, 避免每轮白请求 404。
2. **T0 通道**: 优先提取页面数据层 JSON `coupons":"..."` 字段的码(当期码, 最可靠), 排在提取结果最前, 成为主码 promo_code。
3. **主码选择**: 本次采集码前置拼接 `objs || promo_codes`, 主码取数组首元素(最新当期码)。
4. **产品码过滤**: PRODUCT_CODES[slug] 里的非域名码(托管/VPS/SSL)写入时从现有数组剔除, 避免污染域名价格行。
5. **站级码**写全部 TLD 行, **TLD 特定码**(TLD_CODE_MAP)只写对应后缀行。
6. **结构化源**促销价须低于标准注册价才写(persistStructuredDeals 防脏数据)。

## 6. 经验精华(踩坑总结)

1. **直连型(api/json/html/xhr)服务器开箱即用**;只有 playwright/anti-bot 型依赖外部服务。
2. **落库白名单**: `tlds` 表没有的后缀会被 skip, 新增后缀先 INSERT tlds 表(unicode 明文不带点)。
3. **写库后显式 `UPDATE registrars SET is_active=true`**(sync-registrars 不改 is_active)。
4. **免费转移价**: transfer=0 是合法报价(免费转入), 适配内要 `n>=0`, 其他价 `n>0`。
5. **多级后缀**: 正则须允许点(`[a-z0-9][a-z0-9.-]{1,23}`), 否则 co.za/com.ru 被截断。
6. **千分位逗号**: `"3,546.00"` 先 `replace(/,/g,"")`, 否则 parseFloat 截成 3。
7. **双值促销**: 单元格 `"原价 促销价"` 取第二个小值进 promotionPrice(dualValuePromoColumns)。
8. **促销码采集必须在全量补采后运行**, 否则 storage 覆盖清空 promo_code。
9. **状态排查链**: crawl_queue(入队) → crawl_jobs(执行) → prices.updated_at(新鲜度)。
10. **更新语义**: skip(价格一致)也会刷新 updated_at — updated_at 表示"最近检查时间"。
11. **后台常驻服务**必须 `timeout: 0` 启动, 否则超时被杀。
12. **ccireg 类 Cloudflare JS 挑战**: 特征 `failedChecks` 关键字, 别当"页面结构变了"去改解析。

## 7. 服务器环境豁免清单与依赖校验(2026-10-14 实测)

> 服务器跑 `--all` 后 97 家成功。以下 3 家失败各有独立根因, 均非适配器 bug,
> 无需回滚代码; 但服务器侧需按依赖条件排障。供运维参照。

| slug | 上游可采性(本环境直连) | 服务器失败根因与判定 | 服务器处置 |
|---|---|---|---|
| **one** | ✅ 列表/单价 REST 均 200 | 业务层返回 `TopDomain not found`(平台对服务器出口 IP 的风控/区域拒绝), 与连接无关 | 换服务器出口 IP/代理; 确认 one.com 支持的区域; 或用 `country` 参数试其他区域 |
| **domaincostclub** | ✅ HTTP 200, 329KB | 服务器→站点连接中断, 90s 渲染无法完成(CDN 对服务器 IP 限流或中间链路问题) | 等待站点恢复; 换出口; 服务器可用 `?` 参数不影响直连 |
| **godaddy** | ⚠️ 需穿盾 | `private-api`(无 Key)→ `anti-bot`(需 8090 聚合服务)。服务器未配 `CRAWL_SERVICE_URL` 时裸 HTML 穿不过 Cloudflare 盾 → 超时 | 服务器填 GoDaddy 官方 API Key(developer.godaddy.com); 或部署聚合反爬服务指向 `CRAWL_SERVICE_URL` |

### 7.1 服务器依赖自检命令

```bash
# 直连型源(约 90 家)连通性抽查: one/domaincostclub 上游是否可达
curl -sS -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0" "https://www.one.com/rest/tlds/.com/display-prices/?country=GB"
curl -sS -o /dev/null -w "%{http_code}\n" "https://www.domaincostclub.com/pricing.dhtml"

# playwright 型(PS.kz 等 11 家): 必须 BROWSER_SERVICE_URL 指向健康 worker
curl -sS -X POST "$BROWSER_SERVICE_URL/render" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BROWSER_SERVICE_TOKEN" \
  -d '{"url":"https://www.ps.kz/domains","extract":"html","scrollToBottom":true,"waitForTimeoutMs":12000}'
# 期望: {"ok":true,...含 <tr>}. 若 "浏览器服务队列已满"(502)= worker 卡死需重启

# anti-bot 型(godaddy 等): 必须 CRAWL_SERVICE_URL 指向可用 8090 聚合服务
curl -sS "$CRAWL_SERVICE_URL/health"
```

### 7.2 服务器缺依赖时的降级口径

- 服务器**没有 worker/8090** 时, `--all` 仍安全: playwright/anti-bot 主策略注册商
  会失败但**不影响直连型**; 失败 job 进 crawl_jobs 标记 failed, 不污染 prices 表。
- 上述 3 家在服务器**可接受豁免**(数据新鲜度会落后, 待条件满足后由
  `npx tsx scripts/recrawl-browser-registrars.ts one domaincostclub godaddy` 单独补采)。
- PS.kz 的 URL `https://www.ps.kz/domains` 确认存在直连 122KB 无表格的 JS 渲染页,
  服务器没有 worker 时必然失败, 属预期, 不算回归。