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
  ('hostinger', 'Hostinger', 'https://www.hostinger.com', '全球注册商（立陶宛）。SPA，价格经 XHR 定价接口，捕获 10 个常见 TLD 真实续费/转入价（USD）。', true)
ON CONFLICT (slug) DO NOTHING;