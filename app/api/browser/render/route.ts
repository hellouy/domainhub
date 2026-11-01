/**
 * 与 app/api/browser/route.ts 共用同一代理逻辑。
 * SDK 请求 `${BROWSER_SERVICE_URL}/render`，当 BROWSER_SERVICE_URL 指向
 * `https://<域名>/api/browser` 时实际命中本文件 `/api/browser/render`。
 */
export { POST, GET } from "../route"

export const maxDuration = 120
