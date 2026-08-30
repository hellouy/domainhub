-- =============================================================================
-- 本批落地注册商记录（迭代 1：P0 浏览器通道 + 亚洲/全球源）
-- 对应适配器：
--   adapters/table-registrars.ts（xserver / value-domain / muumuu-domain）
--   adapters/hostinger.ts（hostinger，XHR 捕获）
--   adapters/index.ts（已注册）
-- -----------------------------------------------------------------------------
-- 执行方式（任选其一）：
--   1. Vercel 后台 /admin/registrars 逐条添加
--   2. Neon 控制台 → SQL Editor 粘贴执行
--   3. 本地 `psql "$DATABASE_URL" -f scripts/seed_registrars_asia.sql`
-- 幂等：重复执行安全（ON CONFLICT DO NOTHING）。
-- =============================================================================

INSERT INTO registrars (slug, name, website, description, is_active)
VALUES
  ('xserver', 'Xserver', 'https://www.xserver.ne.jp', '日本注册商。SSR 价格表，覆盖约 255 个 TLD（JPY）。', true),
  ('value-domain', 'Value Domain', 'https://www.value-domain.com', '日本注册商。SSR 全量价格表，覆盖约 469 个 TLD（JPY）。', true),
  ('muumuu-domain', 'ムームードメイン', 'https://muumuu-domain.com', '日本注册商（GMO 系）。SSR 价格表，覆盖约 417 个 TLD（JPY）。', true),
  ('hostinger', 'Hostinger', 'https://www.hostinger.com', '全球注册商（立陶宛）。SPA，价格经定价接口（需鉴权头+cookie），api-fetch 会话内直采全量约 105 个 TLD 真实续费/转入价（USD）。', true),
  ('cloudns', 'ClouDNS', 'https://www.cloudns.net', '保加利亚注册商。JS 渲染全量价格表 1200+ 行，浏览器提取注册/续费/转入价（EUR）。', true),
  ('101domain', '101domain', 'https://www.101domain.com', '北美注册商。div 网格价格页（Cloudflare，浏览器提取），26 主流 TLD 完整价 + 237 新 gTLD 注册价（USD）。', true),
  ('22cn', '22.cn（贰贰互联）', 'https://www.22.cn', '中国注册商。SSR 价格表 `/domain/price/`，98 个主流+中国 TLD 注册/续费/转入/赎回价（CNY）。', true),
  ('westcn', 'West.cn（西部数码）', 'https://www.west.cn', '中国注册商。JS 渲染全量价表 `/web/price/domainpricelist`，118 个 TLD 续费/转入价（CNY）；注册价为混合促销文案，清洗后弃用。', true),
  ('openprovider', 'OpenProvider', 'https://www.openprovider.com', '荷兰批发注册商。内部端点 `/api/pricing-data?currency=USD` 直采，2069 个 TLD 注册/续费/转入/赎回价（USD）。', true),
  ('centralnic', 'CentralNic Reseller', 'https://www.centralnicreseller.com', 'CentralNic 批发官网（HEXONET 并入）。Grid.js 渲染 30 热门 TLD 批发价（USD）；页面超重，浏览器提取间歇可用。', true),
('directnic', 'Directnic', 'https://www.directnic.com', '美国注册商。SSR 价格表 `/pricing`，534 个 TLD 注册/续费/转入价（USD）。', true),
('dreamhost', 'DreamHost', 'https://www.dreamhost.com', '美国注册商。SSR 价格表 `/domains/pricing/`，319 个 TLD 注册/续费/转入价（USD）。', true),
('forpsi', 'Forpsi', 'https://www.forpsi.com', '捷克注册商。SSR 价格表 `/domain/`，229 个 TLD 注册/续费价（CZK，EUR 促销价弃用）。', true),
('juming', '聚名网 Juming', 'https://www.juming.com', '中国注册商。SSR 价格表 `/price.htm`，126 个 TLD 注册/续费/转入价（CNY）。', true),
('blacknight', 'Blacknight', 'https://www.blacknight.com', '爱尔兰注册商。SSR 价格表 `/domain-extensions/`，157 个 TLD 注册价（EUR）。', true),
('onamae', 'お名前.com', 'https://www.onamae.com', '日本注册商（GMO）。JS 渲染价格表，浏览器提取 443 个 TLD 注册/续费/转入价（JPY）。', true),
('infomaniak', 'Infomaniak', 'https://www.infomaniak.com', '瑞士注册商。JS 渲染价格表，浏览器提取 20 热门 TLD 价格（CHF）。', true),
('namesilo', 'NameSilo', 'https://www.namesilo.com', '美国注册商。JS 渲染价格表 `/pricing`，浏览器提取 471 个 TLD 注册/续费/转入价（USD，促销注册价清空）。', true),
  ('truehost', 'Truehost', 'https://truehost.cloud', '肯尼亚注册商。JS 渲染价格表 `/domains`，浏览器提取 577 个 TLD 注册/续费/转入价（USD）。', true),
('hostingkr', 'Hosting.kr', 'https://www.hosting.kr', '韩国注册商。JS 渲染价格表 `/domain`，浏览器提取 12 个 TLD 注册/续费/转入价（KRW）。', true)
ON CONFLICT (slug) DO NOTHING;