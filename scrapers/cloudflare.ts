/**
 * scrapers/cloudflare.ts
 *
 * 对外入口：Cloudflare Registrar 采集器。
 * 实际实现位于 lib/crawler/adapters/cloudflare.ts（遵循既有 Adapter 架构）。
 * 未来注册商同理：scrapers/porkbun.ts、scrapers/spaceship.ts 等
 * 只需转发各自的 Adapter。
 */
export { CloudflareAdapter, cloudflareAdapter } from "@/lib/crawler/adapters/cloudflare"
