# 需求文档：特价与优惠券（deals-and-coupons）

## Introduction

「TLDbi」是一个专业域名价格对比站。当前系统已收录 56 家活动中的注册商、26,000+ 条价格记录，能对比各注册商的「注册/续费/转移」标准价。但注册商常以促销价（首年特价）与优惠码（coupon/promo code）吸引新用户，这部分信息当前既未落库也未对用户呈现，"该后缀最便宜的价格是多少、在哪家、有没有优惠码"无法直接回答。

本特性为系统补充「特价与优惠券」能力：新增价格口径「促销价」（promotion price），修改「最便宜」排名逻辑（有促销价取促销价、无则标准注册价），并提供后端存储与查询 API，为后续前端 Deals 页与 TLD 详情页展示打底。

## Glossary

- **标准注册价（standard register price）**：`registerPrice`，注册商公开售价，不含任何首年折扣或优惠码。
- **促销价（promotion price）**：`promotionPrice`，注册该后缀首年的优惠价格（可能来自折扣活动或优惠码结算价）；为空时表示该注册商当前无此 TLD 的促销。
- **优惠码（promo code）**：`promoCode`，结算时可输入的折扣码字符串，可能是公开展示的常态折扣码或活动码。取值为可空字符串。
- **促销截止（promotion ends）**：`promotionEndsAt`，促销价适用的截止时间（UTC），可空。为空表示促销时间未知或长期有效。
- **有效促销条目（active deal）**：注册商×后缀维度下，`promotionPrice` 非空且（若设了截止时间则）未过期的记录。
- **最便宜价格（effective price）**：对某后缀在某个注册商处，`promotionPrice` 非空时取 `promotionPrice`，否则取 `registerPrice`；用于「哪个注册商最便宜」的排序。
- **特价聚合源（coupon source）**：公开维护、可持续抓取的优惠/优惠码清单页（如注册商官方优惠页、公开会员优惠表）。

## Requirements

### Requirement R1：促销价数据模型持久化

**User Story:** AS 域名比价用户，I want 系统保存每个注册商×后缀的促销价、优惠码与截止时间，so that 我能看到真实的优惠信息而非只有标准价。

#### Acceptance Criteria

1. WHERE 每个「注册商×后缀」价格记录, THE 系统 SHALL 持久化标准注册价、续费价、转移价与促销价、优惠码、促销截止时间六类数据。
2. WHEN 采集到某记录但未提供促销价, THE 系统 SHALL 将该记录的促销价、优惠码、促销截止时间存为空 (null)。
3. WHEN 采集到促销价且促销价等于或高于标准注册价, THE 系统 SHALL 将促销价记为空并打日志提示「促销价不低于标准价」。
4. WHEN 促销截止时间早于当前时间, THE 系统 SHALL 将该记录的促销价视为过期并使该记录不再作为有效促销条目返回。
5. WHERE 价格历史记录, THE 系统 SHALL 一并记录促销价、优惠码与促销截止时间，以支持差异对比与回滚。

### Requirement R2：现有注册商促销字段落库

**User Story:** AS 域名比价用户，I want 系统真正保存 hostinger/porkbun/dynadot 等已解析出的促销标记，so that 既有数据源立刻具备促销能力。

#### Acceptance Criteria

1. WHEN 适配器在 `RawPrice`/`NormalizedPrice` 中提供 `promotion: true`, THE 系统 SHALL 依据当前 `registerPrice` 对应的促销语义尝试解析促销价并落库。
2. WHEN 适配器在 `RawPrice` 中提供促销价字段, THE 系统 SHALL 原样持久化该促销价与（如有的）优惠码、截止时间。
3. WHEN 适配器仅提供 `promotion: true` 但无促销价数值, THE 系统 SHALL 保留标准注册价并将促销价存为空，且不阻断采集。
4. WHERE `NormalizedPrice` 模型, THE 系统 SHALL 增加可选字段 `promotionPrice`、`promotionEndsAt`，并保留既有 `promotion`、`promoCode` 字段以保证向后兼容。

### Requirement R3：特价聚合源采集

**User Story:** AS 平台运营, I want 系统从公开的优惠/优惠码清单持续采集特价与优惠码, so that 覆盖现有 56 家之外的新优惠并核验存量促销。

#### Acceptance Criteria

1. THE 系统 SHALL 支持按「特价聚合源」组织的一批 CSV/静态 HTML/JSON 采集适配器，每个源声明其来源域名、更新频率与解析规则。
2. WHEN 聚合源提供某注册商×后缀的促销价或优惠码, THE 系统 SHALL 将该促销写入对应注册商的促销字段（以后缀自身价格数据为准合并）。
3. WHERE 聚合源无法归属到某已收录注册商, THE 系统 SHALL 记为该源的白名单外部条目（仅供运营核批量接入参考），并记录命中的注册商域名。
4. WHEN 采集聚合源失败达到该源配置的重试上限, THE 系统 SHALL 将该源标记为失败并跳过本轮，不阻塞其他源。
5. WHEN 优惠码来源为第三方聚合站（反爬或使用条款限制），THE 系统 SHALL 优先采用公开/低频率抓取，对高频反爬源按「实用主义」约定降低频率或标记跳过。

### Requirement R4：最便宜排名口径

**User Story:** AS 域名比价用户，I want 系统按「有促销取促销价、无则标准价」口径计算最便宜, so that 我能看到实际最省的注册商。

#### Acceptance Criteria

1. WHERE 计算某后缀的最便宜注册商, THE 系统 SHALL 以其「最便宜价格」最小者为准，促销价非空时促销价即最便宜价格，否则标准注册价即最便宜价格。
2. WHEN 某后缀下存在多个注册商的促销价, THE 系统 SHALL 按促销价升序排列并可在返回中标注「促销中」标识。
3. WHEN 促销价与标准注册价相等, THE 系统 SHALL 不把该记录标记为促销说明，仅当作常规价格参与比较。
4. THE 系统 SHALL 支持在 API 返回中同时给出最便宜注册商、其标准注册价、促销价与优惠码（若存在）。

### Requirement R5：查询 API

**User Story:** AS 前端开发者, I want 一套能取回促销/最便宜的 API, so that 后续可构建 Deals 页与 TLD 详情页。

#### Acceptance Criteria

1. WHEN 查询某后缀价格, THE 系统 SHALL 返回该后缀下各注册商的注册/续费/转移/促销价/优惠码/促销截止信息。
2. WHEN 启用「仅看有促销」过滤, THE 系统 SHALL 只返回当前有效促销条目，并按促销价升序排列。
3. WHEN 查询全部有效促销条目, THE 系统 SHALL 分页返回促销价、注册商名、后缀、优惠码与促销截止时间。
4. WHEN 查询最便宜列表, THE 系统 SHALL 返回各注册商按「最便宜价格」升序的排行，并在字段中标注是否促销中。

### Requirement R6：既有标准价查询兼容

**User Story:** AS 现有 API 消费者, I want 原有价格接口不破坏, so that 已上线的比价视图不被破坏。

#### Acceptance Criteria

1. WHERE 现有 `/api/v1/prices` 接口, THE 系统 SHALL 保持既有响应结构，并新增可选的促销字段以向后兼容。
2. WHEN 前端未请求促销字段, THE 系统 SHALL 仍返回可用的标准价格数据。
3. WHERE 数据库中既有价格行, THE 系统 SHALL 通过迁移将促销列设为默认空，且不改变既有标准价数值。

## Non-Functional Requirements

- **性能**：促销价与标准价同表存储，查询某后缀时应与现有价格查询同量级（索引不变，最坏多一次覆盖索引排序）。
- **安全**：优惠码来自公开来源，禁止接入任何需登录/付费会员的私有优惠站；聚合源抓取须遵循目标站点 robots.txt 与使用条款，设置限流与退避。
- **可观测性**：每个特价聚合源采集结果写入 crawl_logs；促销价被清理（过期/不低于标准价）时记录日志。
- **一致性**：促销价属于「注册商×后缀」维度，与其他价格字段共用同一唯一键 (registrar_id, tld_id)，不允许单独存在的促销条目。

## Out of Scope

- 前端 Deals 聚合页与 TLD 详情页 UI（用户明确本轮先做后端+API）。
- 各注册商需登录结算流程才能看到的私有优惠（无法公开抓取）。
- 优惠码的核销/追溯结算是否可用（平台无法代为下单验证）。