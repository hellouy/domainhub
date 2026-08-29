-- =============================================================================
-- 亚洲批次：新增注册商记录（第一轮）
-- 对应适配器：adapters/table-registrars.ts（xserver / value-domain）
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
  ('value-domain', 'Value Domain', 'https://www.value-domain.com', '日本注册商。SSR 全量价格表，覆盖约 469 个 TLD（JPY）。', true)
ON CONFLICT (slug) DO NOTHING;