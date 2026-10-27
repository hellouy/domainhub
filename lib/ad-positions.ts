/**
 * 广告位置定义。纯常量，无 server-only 依赖，前后台均可引用。
 * 新增位置时在此追加即可，后台自动可选。
 */
export const AD_POSITIONS = [
  { position: "home-search", label: "首页 · 搜索框下方" },
  { position: "home-bottom", label: "首页 · 底部" },
  { position: "tld-detail-top", label: "TLD 详情页 · 顶部" },
  { position: "tld-detail-bottom", label: "TLD 详情页 · 底部" },
  { position: "registrar-detail-top", label: "注册商页 · 顶部" },
  { position: "registrars-list-sidebar", label: "注册商列表 · 侧栏" },
  { position: "tld-list-sidebar", label: "后缀列表 · 侧栏" },
] as const

export type AdPosition = (typeof AD_POSITIONS)[number]["position"]

export const ALL_AD_POSITIONS = AD_POSITIONS.map((p) => p.position)

export function positionLabel(pos: string): string {
  return AD_POSITIONS.find((p) => p.position === pos)?.label ?? pos
}
