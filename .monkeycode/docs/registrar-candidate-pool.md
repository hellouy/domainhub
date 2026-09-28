# 注册商候选采集池（Backlog）

> 所有权: Data Team · 最近核查: 2026-09-28
>
> 用途: 记录已系统性探测但尚未入适配器的注册商，标注"解锁条件"，供联网检索/凭据恢复后按优先级补采。已入适配器且在采的注册商见 `adapters/index.ts`（当前 29 active / 18 inactive）。
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
| infomaniak | infomaniak | 数百 | 🔒 需凭据 | 页面 bot 拦截 ERR_CONNECTION_CLOSED；当前 20 行为次级源 | 提供 Infomaniak API token |
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

## 建议执行序（按解锁条件就绪时）

1. 提供 gandi/infomaniak Key → 立即可把 42/20 扩到数百，收益最大。
2. 提供 namecheap/godaddy/netim Key → 三家大注册商全量补回。
3. 联网检索恢复 → 验证上表"未探测高潜力"新名单，命中即接入。
4. **面向各大洲中小型注册商做广度扫描**（优先自行完成，不需外部解锁）: 挑干净 SSR 表格/公开 JSON/简单 XHR 源的注册商接入，避免死磕已被反爬或需凭据锁定的头部大厂。命中标准: 无登录、无 Cloudflare、表结构稳定；命中即按 dynadot/hostinger 的 XHR 首选法或干净表格法接入。
5. 其余 🛡/🏗/🌀/❌ 项：仅拆分给专项 subagent 且用户明确授权"允许反爬/逆向/登录"时才做，否则保持 📌 待解锁；`❌ 无公开源` 项（如 alibaba-cloud-intl）默认不再重复试探。

> 注: 平台护栏禁止反爬绕过/逆向/威胁登录对抗。上表 🛡/🏗/🌀 项默认不攻，仅记录解锁条件。