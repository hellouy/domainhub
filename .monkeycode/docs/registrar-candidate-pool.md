# 注册商候选采集池（Backlog）

> 所有权: Data Team · 最近核查: 2026-09-28
>
> 用途: 记录已系统性探测但尚未入适配器的注册商，标注"解锁条件"，供联网检索/凭据恢复后按优先级补采。已入适配器且在采的注册商见 `adapters/index.ts`（当前 32 active / 19 inactive）。
>
> 状态图例补充:
> - `❌ 无公开源` — 系统性探测后确认无游标外的公开价格源（登录门控 SPA / 需凭据接口），按平台规范不逆向，直接降级，勿重复试探。

## 读取约定

- **状态**:
  - `🔒 需凭据` — 有公开/半公开接口但需 API Key / 代理商账号
  - `🛡 反爬` — 页面带 Cloudflare / bot 校验 / 验证码，需浏览器且不稳定
  - `🏗 结构漂移` — 适配器已写但页面结构变更导致空解析
  - `❄ 低温` — 访问慢/间歇，不值得长期依赖
  - `🌀 需逆向` — 价格在 JS 打包内，需逆向前端（禁止，仅记录）
- **优先级**: 高 = 大注册商且覆盖广，解锁后立即做；中 = 中等；低 = 小众。

## 候选列表

| 注册商 | slug | 覆盖潜力 | 状态 | 观察到源/问题 | 解锁条件 |
|--------|------|---------|------|----------------|----------|
| gandi.net | gandi | 700+ | 🔒 需凭据 | api.gandi.net 返回 401；SSR 页仅 42 行、无定价 XHR | 提供 api.gandi.net API Key（Organization） |
| infomaniak | infomaniak | 数百 | ❌ 暂不可用 | 页面 bot 拦截，抓到的 20 行为脏数据（com=3313 CHF），已从适配器注册表移除 + DB is_active=false；若恢复需 Infomaniak API token | 提供 Infomaniak API token 后需验证数据质量再入采 |
| namecheap | namecheap | 全量 | 🔒 需凭据 | private-api 报 APIUser 参数错误（未配置 key） | 提供 Namecheap API key + username |
| godaddy | godaddy | 全量 | 🔒 需凭据 | private-api fetch failed（未配置 key） | 提供 GoDaddy API key |
| netim | netim | 数百 | 🔒 需凭据 | private-api 会话 HTTP 400（代理商 ID/密钥未启用） | 提供 Netim 代理商 ID + 密钥 |
| 1API/HEXONET | 1api | 全量 | 🌀 需逆向 | api.1api.net 直连 000/404；无公开价格 JSON | 提供 ResellerClub/HEXONET API 凭证 |
| ResellerClub | resellerclub | 全量 | 🌀 需逆向 | 需代理商账号；无公开价表 | 提供代理商 API |
| enom | enom | 全量 | 🌀 需逆向 | 需 ETP/EIP API Key | 提供 Enom API 凭证 |
| OpenSRS / Tucows | opensrs | 全量 | 🔒 需凭据 | 需邮箱+私钥 | 提供 OpenSRS 凭证 |
| GMO (onamae 母公司) | gmo | 较大 | 🙂 已有 onamae | onamae 已入采 443 | （onamae 已覆盖） |
| DreamHost | dreamhost | 数百 | ✅ 已入采 | — | 已采 319 |
| hover.com | hover | 数百 | 🏗 结构漂移 | 价格页 https://www.hover.com/tlds 返回 HTTP 404 | 需新 URL 或改抓取（小额） |
| internetbs | internetbs | 数百 | 🏗 结构漂移 | 页 /pricelist.html 提取脚本找不到价格行（JS 渲染） | 需 playwright/逆向该页 |
| transip | transip | 数百 | 🏗 结构漂移 | /domein-registreren/ 表解析空（JS 渲染） | 需逆向定价 XHR |
| registercom | registercom | 数百 | 🏗 结构漂移 | /domains/domain-pricing 404 | 需新 URL |
| metaname | metaname | 中小 | 🏗 结构漂移 | /pricing 404 | 需新 URL |
| loopia | loopia | 中小 | 🏗 结构漂移 | loopia.se/domain/ 404 | 需新 URL |
| domeneshop | domeneshop | 中小 | 🏗 结构漂移 | domene.shop/priser 404 | 需新 URL |
| netcup | netcup | 中小 | 🏗 结构漂移 | netcup.com/en/domain 404 | 需新 URL |
| lws | lws | 数百 | 🛡 反爬 | lws.fr/nom-de-domaine.php 403 | 需绕过 Cloudflare（不稳定） |
| amen | amen | 中小 | 🏗 结构漂移 | amen.fr/noms-de-domaine/ 404 | 需新 URL |
| aruba | aruba | 数百 | 🏗 结构漂移 | aruba.it/domini/... 404 | 需新 URL |
| eurodns | eurodns | 20 | ❄ 低温 | 页面间歇（20/20/0 行），20 行即上限 | 页面稳定后再接（低价值） |
| onecom | onecom | 数百 | 🛡 反爬 | embedded-json fetch failed | 需稳定 API |
| exabytes | exabytes | 数百 | ✅ 已入采 | 已修：URL→/domain-name-search，去掉卡死 worker 的 waitFor:"table" | 已采 62（register-only，MYR） |
| networksolutions | networksolutions | 全量 | ✅ 已入采 | 已修：URL→/domains/domain-name-pricing + 补 transfer 列 | 已采 32 |
| juming (聚名) | juming | 数百 | ✅ 已入采 | 已修：加 playwright waitForTimeoutMs+scrollToBottom 兜底 | 已采 119（CNY） |
| westcn | westcn | 118 | ✅ 已入采 v2.0.0 | 已修：自定义 script 精确定位 El-popover 各列（reg/renew/transfer） | 已采 118（reg/renew/transfer 全对，CNY） |
| ukrnames | ukrnames | 471 | ✅ 已入采 | createTableAdapter 标准 `<tr>/<td>` 表（UA 本地价格，UAH） | 已采 471（register/renew/transfer/restore，UAH） |
| idwebhost | idwebhost | 243 | ✅ 已入采 | `<option data-hs-select-option='{...}'>` 内嵌 JSON | 已采 243（register only，IDR） |
| keliweb | keliweb | 668 | ✅ 已入采 | `<li data-val data-p>` 中 data-p=年续费价，`<del>€X</del> €Y`：X=续费、Y=促销注册价；无 del=单值沿用双列。2026-09-28 源验证后修正（.com 12.72/15.90，.it 促销年免 null/12.90） | 已采 668（EUR，直连偶 303 stub，需浏览器重试） |
| jagoanhosting | jagoanhosting | 194 | ❌ 已否决 | 194 行 TLD 但 151 行解析失败（每 TLD 结构变化） | 结构不稳定，接入价值低 |
| alibaba-cloud-intl | aliyun | 全量 | 🌀 需逆向 / ❌ 无公开源 | 海外版 www.alibabacloud.com/domain 为登录门控 SPA，load 时零价格 XHR（仅 is_login/log），无游标外公开价表 | 需 Alibaba Cloud 域业务 API/SDK 凭证（intl），或用 api 策略接 CreateOrder/查询域（需鉴权） |
| ionos/1&1 | ionos | 全量 | 🛡 反爬 | 域名页 301/404 + bot 保护 | 需过 bot（不稳定） |
| squarespace | squarespace | 数百 | 🌀 需逆向 | 仅购物车 API，无公开全量价表 | 需逆向前端 |
| pairnic | pairnic | 中小 | ❄ 低温 | 无干净公开端点 | — |
| easydns | easydns | 中小 | ❄ 低温 | 无干净公开端点 | — |
| netfirms / moniker / letz | — | 中小 | ❄ 低温 | 均无干净公开价表 | — |

## 未探测但高潜力的公开 API 型注册商（联网恢复后优先验证）

> 这些是已知体量大、或有公开接口的注册商，联网工具恢复后可先 resolve-library-id / 直接抓取验证，命中即按 dynadot/hostinger 的 XHR 首选法接入。

- **NameSilo API** — 已有 adapter（private-api），验证覆盖
- **Porkbun API** — 已有
- **Hostinger API** — 已有（xhr 首选）
- **Dynadot API** — 已有（xhr 首选）
- **OpenProvider API** — 已有
- 候选新增: **1API/HEXONET**、**ResellerClub API**、**Enom API**、**Netim API**（均需凭据）
- 候选新增（可能公开 JSON）: **99RDP/Namesilo 竞品**、**Sav.com**、**101domain(已有)**、**BigRock API**、**HostPoint(已有)**

## 2026-09-28 广度扫描复核（数据排查 + 新源探测）

- **keliweb 数据修正**：定位 reg/renew 误标（真值见上表），已按源修正入库并部署。
- **namecom 促销贴纸**：XHR 定价接口返回 400 后回落浏览器抓取到首年促销价（$1 贴纸），导致 register 普遍 $1/行。已加全局 guard：`register < renew/3 → null`（用续费标准价兜底），`.co/.app` 等已置 null，`.com/.net/.org` 保留真实标准价。
- **forpsi 期限列误解析**：表行第 2 列"1 rok"被当注册价（220 行 $1.00 CZK）。已改 `columnOrder:["skip","skip","register","renew"]`，`.xyz 400/400`、`.org 360/385` 等真实 CZK 恢复；DB register<=2 行清零。
- **ovhcloud 全 0 占位清理**：目录 API 中 register/renew/transfer 全为 0 的 TLD（br、gr.com、net.cn、org.cn、hu.net、in.net、jpn.com、mex.com、se.net）并非 €0 促销而是占位，已跳过 + 删 DB 旧行。
- **全局数据口径 guard**（export-prices.ts）：① register<renew/50 → null（散射）；② register<renew/3 → null（促销贴纸口径归一）；③ register<=2 且 renew/transfer 均 null → null（term/数量误解析）。全 32 家 register<renew/3 行已为 0。
- 广为探测被封锁/低价值、勿重复试探：namecheap.com、domain.com、bigrock.in、crazydomains、hostgator、niagahoster、epik、exabytes(my/api)、one.com、wedos（60s 超时）、registrobr/123-reg/openprovider/active24（SPA 且仅 10+ 行）、sav.com/internetbs（连接超时）、fles större CF/JS 挑战。
- 仍未打通的主杠杆（阻塞 100+）：ResellerClub/1API/Enom/netim/namecheap/godaddy 批发 API，全部需代理商凭证；平台护栏禁止反爬/逆向。

## 建议执行序（按解锁条件就绪时）

1. 提供 gandi/infomaniak Key → 立即可把 42/20 扩到数百，收益最大。
2. 提供 namecheap/godaddy/netim Key → 三家大注册商全量补回。
3. 联网检索恢复 → 验证上表"未探测高潜力"新名单，命中即接入。
4. **面向各大洲中小型注册商做广度扫描**（优先自行完成，不需外部解锁）: 挑干净 SSR 表格/公开 JSON/简单 XHR 源的注册商接入，避免死磕已被反爬或需凭据锁定的头部大厂。命中标准: 无登录、无 Cloudflare、表结构稳定；命中即按 dynadot/hostinger 的 XHR 首选法或干净表格法接入。
5. 其余 🛡/🏗/🌀/❌ 项：仅拆分给专项 subagent 且用户明确授权"允许反爬/逆向/登录"时才做，否则保持 📌 待解锁；`❌ 无公开源` 项（如 alibaba-cloud-intl）默认不再重复试探。

> 注: 平台护栏禁止反爬绕过/逆向/威胁登录对抗。上表 🛡/🏗/🌀 项默认不攻，仅记录解锁条件。
## 2026-09-29 全量价格核验（重新识别）

对现有全部 active 注册商做了一轮全量重采（32 家 / 16803 条，BROWSER_SERVICE_URL 渲染）并逐家逐 TLD 与库中当前值 diff：

- **30 家完全一致（0 差异）**：cloudflare/porkbun/dynadot/ovhcloud/gandi/namecom/namesilo/onamae/hostpoint/xserver/value-domain/muumuu-domain/hostinger/cloudns/101domain/22cn/westcn/openprovider/krystal/directnic/dreamhost/forpsi/juming/blacknight/exabytes/networksolutions/hostingkr/inwx/ukrnames/idwebhost/keliweb —— 现有价格识别全部准确。
- **truehost 唯一异常 → 已修正并部署**：
  - 原值来源是 `truehost.cloud`（USD），且该域现已不可访问（直连 0 字节、渲染 60s 超时），本次重采意外走浏览器把 register/renew 列整体左移错位。
  - 实际价格源 `truehost.co.ke/domains/` 页面币种是肯尼亚先令 **KES**，库中却误标 USD。
  - 修正：切回 `truehost.co.ke`，currency `USD→KES`，`columnOrder` 加 `"skip"` 忽略 Grace Period 列。com=999/1600/1259、co.ke=999/1500/1000、ke=2999/3000/2999（KES），全部与源一致。
  - 清理库中残留 119 条 USD 专属 tld，truehost 现为 514 行全 KES。commit `e40d2d6` 已部署生产 READY。
- **生产最终统计**：32 active / 3001 tlds / 16817 prices，lastUpdated 2026-09-29。

结论：现有 32 家爬取价格全部重新识别为准确，唯一修正点为 truehost 的币种标注（USD→KES）与来源 URL。

## 2026-09-29 各洲广度扫描（IANA/ICANN 注册商扩量）

应"按 IANA 注册的各洲注册商扩充价格"，从 ICANN 官方认证注册商名单（含 IANA Number/Country）抓取并按七大洲系统探测了 **90+ 注册商公开价格页**，多数为直连+浏览器双探。结果与既有候选池判断一致：**能被干净接入的新源极稀缺**。分区结论：

- **非洲**：dns.africa（table waitFor 超时）、afrihost 404、domains.co.za 403、绝大多数 ENOTFOUND/超时。❌ 无干净公开价表。
- **南美**：registro.br SPA、locaweb/kinghost 价格在 div/JS、hostgator.mx/donweb 403 CF。❌。
- **大洋洲**：webcentral/melbourneit/ventraip/synergy 渲染 60s 超时（候选池已记不稳定）；crazydomains 403；netregistry 超时。❌。
- **中东**：arab.com/seen/enjaz 渲染后无价格行；aeida/qacert/saudinic ENOTFOUND/EAI_AGAIN。❌。
- **南亚**：znetlive 超时、hostgator.in/bigrock.resellerclub 403 CF、milestone 空页。❌。
- **东南亚**：rumahweb tld 广(1419)但价格为文字混排非列式、核心通用 tld 少、难适配；niagahoster/webcentral SPA；dewaweb 403。**候选但低优先**。
- **欧洲**：ionos/hosteurope/online/strato SPA、fasthosts 404、njal 超时、netcup 渲染无价格。❌。
- **北美**：pair/hover/dotster/web.com/register.com/namecheap/godaddy 全 403 CF 或 SPA。❌。
- 唯一稳定的 JSON/text 源 porkbun.com/tld/pricing.json 但 porkbun **已入采**。

**结论**：公开可无凭据/无 CF 直接抓的干净价格源已基本采尽（即当前 32 家）。要扩到 50+ 需依赖：① 批发 API 凭据（gandi/infomaniak/namecheap/godaddy/netim/Enom 任一，一源覆盖数百 TLD）；② 浏览器 worker 提升超时+稳定性后对澳洲等慢源重试；③ 修改接危标准放行"价格混排文字"型源（如 rumahweb，适配成本高、通用 tld 覆盖低）。本轮验证 `porkbun.com/tld/pricing.json` 可作价格事实基准。

## 2026-09-29 后台 API 适配骨架就绪（填 Key 自动生效）

为「各大需 API 的注册商」在后台预置适配器骨架，`is_active=false` 就绪、填 Key 即自动激活采集（见 MEMORY 机制）：

| slug | 适配 | 凭证类型 | 状态 |
|------|------|---------|------|
| godaddy | private-api (两步探测注册价) | api_key token/secret | ✅ 已就绪，DB 待 Key |
| namecheap | private-api (getPricing XML) | api_key token/username/clientIp | ✅ 已就绪，DB 待 Key |
| netim | private-api (session + 逐 TLD) | basic username/password | ✅ 已就绪，DB 待 Key |
| gandi | private-api (v5 tlds/prices) + html 降级 | api_key token | ✅ 已补 API 策略(有 Key 数百/无 Key 42 行)，DB active |
| enom | private-api (GetDomainPricing) | basic UID/PW | ✅ 骨架新建，DB 待 Key |
| infomaniak | private-api (api.infomaniak.com) | api_key token | ✅ 骨架新建，DB 待 Key |
| resellerclub | private-api (economypricing.json) | api_key token/secret | ✅ 骨架新建，DB 待 Key |

> 骨架契约（各家 API 价格字段名）标注了「需真实 Key 首采核验微调」，首采后按实际返回微调 parse 即可。1API/HEXONET 保留候选池「🌀需逆向」未建骨架（凭证结构复杂，待需时再加）。

## 2026-09-29 Spaceship（http://spaceship.com / spaceship.dev）评估：不接入价目采集

- 认证：X-Api-Key + X-Api-Secret header（两值不编码），spaceship.dev 验证有效，能取账户域名列表
- API 能力（Read 仅）：域名管理/列表/详情、可用性检查、contacts、DNS、transfer、SellerHub、Hyperlift；**无全量 TLD 价目表端点**
- 唯一涉价为 GET/POST /api/v1/domains/available（按完整域名），只返回 premiumPricing（premium 溢价 register 一档价），无 register/renew/transfer 常规三档价目
- 判定：与价目表采集（每 TLD 三档价矩阵）不匹配；实时 premium 查询价值低且引入查询延迟。**保持候选池，不建适配器**。若未来需要 premium 溢价查询可考虑，但非本产品价目口径
- 关键：不要靠 spaceship.com 网页抓价（Cloudflare 403）

### 补充实测：spaceship.com 网页"有价"但无法批量抓（2026-09-29）

- 页面 https://www.spaceship.com/zh/domain-search/?tab=pricing&query=com 是 React SPA + Cloudflare
- 浏览器渲染能拿到 1.4MB HTML 壳（title 域名搜索），但壳内**无任何价格/水合数据**（无 __NEXT_DATA__/registerPrice/tldPrices）
- `query=com` 空载状态不发定价 XHR（xhr-json 捕获 0 条）→ 价格只在用户**输入完整域名并提交查询**后通过异步接口加载
- render worker 无"输入+点击驱动交互"能力，只能 goto/waitFor/scroll，无法触发那个查询
- Cloudflare challenge 会话**不稳定**：同 URL 多次渲染时而 1.4MB 完整壳、时而 "Just a moment..." 挑战页
- 结论：该页虽展示价格，但属交互式登录墙 SPA + CF 高对抗，无 SSR 内嵌、无稳定可枚举接口，无法作为自动价目采集源

## 2026-09-29/10-02 tldhub 索引发现与 18 家命中接入

- **发现索引**：`tldhub.com/{tld}` 每页 ~144 家注册商 `data-*_plain`(reg/ren/tra) 三档价，覆盖 ~30 主流 TLD；`tldhub.com/registrar/` 列 **149 家**注册商。
- **方法**：以 tldhub 为发现索引，对 149 家逐个探索**官方源**（上游可枚举价目），命中标准：无登录、无 Cloudflare、价格结构化(静态表/内嵌 JSON/公开 API/稳定 XHR)、覆盖 ≥10 TLD。SPA 无接口/需登录/反爬不算命中。tldhub 聚合页本身不入库（仅当索引）。
- 117 家经 3 批并行 subagent 探测，命中率 ~17%，**18 家命中**；用户选定**全量接入**。

### 已接入 16 家（含 tierla/connectreseller 首批，2026-09-29 已上）
| slug | 源结构 | 覆盖 | 币种 | Parse 验证 |
|------|--------|------|------|-----------|
| tierra | JSON `{tld:[reg,renew,transfer,sale,type]}` | 359 | USD | 100% ✓ |
| connectreseller | 静态表(需整页实体解码) | 650 | USD | 100% ✓ |
| joker | XHR `result.pricelist.domains[*].*.total.display_total` | 598 | USD | 100% ✓ |
| nicnames | API `registrars[].prices[]=[tld,reg,renew,transfer]`(取自家) | 599 | USD | 100% ✓ |
| epik | API `load-200-plus-prices`(Standard 档) | 705 | USD | 100% ✓ |
| one | REST 每 TLD `display-prices`(仅 register) | 20 | GBP | 100% ✓ |
| interserver | 静态 `a.tld-row`×3 `span.tld-cost` | 503 | USD | 100% ✓ |
| ultahost | 静态 `data-usd` + label(<tr> 未闭合按边界切) | 534 | USD | 100% ✓ |
| domaincostclub | 静态表 panels(members) 3 列 | 459 | USD | 100% ✓ |
| imena | 静态 `magicprice_UAH` 注册价 | 361 | UAH | 100% ✓ |
| regtons | 静态表(fr 千分位/逗号小数) | 1092 | USD | 100% ✓ |
| icdsoft | 静态微数据表(独立注册价) | 30 | USD | 100% ✓ |
| istanco | 静态隐藏表 3 档价 | 48 | EUR | 100% ✓ |
| mchost | 静态 `dom_list`(rub 字形, 注册/续费混合) | 380 | RUB | 100% ✓ |
| hostafrica | 静态表 `R` 前缀 | 10 | ZAR | 100% ✓ |
| osir | 静态 3 列表 | 17 | USD | 100% ✓ |

### 证伪剔除
- **fabulous** — 探测误判命中；实为 **Tier 批发阶梯价**(按账户 TLD 数量档), 非 TLD 价目矩阵, 剔除。

### 结构要点（踩坑记录）
- connectreseller 价格单元格为数值 HTML 实体(`&#36;`=$)，须整页 `&#NNN;`→字符 解码后再解析，否则 parsePrice 误读成 36。
- ultahost/个别源 `<tr>` 未闭合，按 `<tr` 标签边界 split 切行，不能依赖 `/<\/tr>/`。
- imena 定位净 `magicprice_UAH` div 为实付注册价，需 UA+Accept-Language header 拿英文页(取 63s，间歇超时)。
- regtons 用 **空格=千分位、逗号=小数**(fr 格式)，`1 020,00`=1020.00；mchost 卢布用 `span.ruble` 字形、多数行仅注册价。
- one.com 仅暴露 register(fullPrice)，无 renew/transfer；`tld` 须带前导点否则 400。

## 第二轮接入（非 tldhub 索引，新增探索）— 6 家，commit `d8a62ef`，部署 READY `dpl_3vMsHRS52AUVphsxNKstrz2vgcjJ`

子代理对 12 家非 tldhub 149 的新候选探测，7 家命中，实际接入 6 家（truehost 已存在于 table-registrars 聚合）。

| slug | 策略 | 行数 | 币种 | 验证 |
|------|------|------|------|------|
| iwantmyname | HTML API `Prices-getPrices`(分页 limit=500, levels=IWMN, currency=USD) | 668 | USD | 100% ✓ |
| gname | POST `request/get_price`(整页内嵌 JSON) | 86 | USD | 100% ✓ |
| onlydomains | 静态表(单元格数值实体+`,`) | 896 | AUD | 100% ✓ |
| easyspace | createTableAdapter(GBP) | 570 | GBP | 100% ✓ |
| whc | `table.tlds-table`（tld/price/renewprice **属性在 `<tr>` 开标签上**) | 441 | CAD | 99.8% ✓ |
| wpx | 下单页内嵌 JSON `"products":[`（须 balanced-bracket 提取，index≈120132） | 40 | USD | 100% ✓ |

### 证伪 / 放弃（本轮）
- **rebel** — SPA，数据顿 client-fetch 获取，无静态表 → 不入
- **dondominio** — SPA 无静态批价表 → 不入
- **lcn** — term-only 行少价稀；**eurodns** — 仅逐 TLD 独立页 → 不入
- **fastcomet** — ClearBook per-search，无全域表 → 不入

### 结构要点（第二批踩坑）
- **iwantmyname** `tld` 带前导点，levels=IWMN 过滤 + currency 参数；分页按 limit。
- **whc** 种的 `tld=".ca" price="10.99" renewprice="C$14.99"` 全部是 `<tr>` 的**标签属性**，用 `split(/<tr...>/)` 会把属性随开标签吞掉 → 必须直接 regex 匹配 `<tr[^>]*>` 再取属性；renewprice 含 `C$` 前缀，价格正则需 `[\d.]+`。
- **wpx** 页面有多个 `"products"`：index 119681 是模块配置，**真域名数组在 index 120132**（40 个含 periods[0]{title,value,register,transfer,renew}），须 balanced-bracket 提取；.com register 14.99 / transfer 14.99 / renew 16.99。
- **truehost** 删除重复：已由 `adapters/table-registrars.ts` 的 createTableAdapter(slug truehost, KES, url truehost.co.ke/domains/) 覆盖。
