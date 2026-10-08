/**
 * TLD 热度表(共享)
 * 分值越大越靠前。前 POPULAR_FLAG_COUNT 个标记为 is_popular(首页"热门"标签)。
 * clean-tlds.ts(初始化) 与 mark-popular-tlds.ts(线上标注) 共用,避免双份漂移。
 */
export const POPULARITY: Record<string, number> = {
  // 顶级热门(通用)
  com: 1000, net: 980, org: 970, io: 950, ai: 945, co: 930, app: 920, dev: 915,
  xyz: 910, me: 905, info: 900, cc: 895, tv: 890, online: 885, site: 880, top: 875,
  // 热门国别
  cn: 870, de: 865, uk: 860, us: 855, eu: 850, jp: 845, fr: 840, in: 835,
  // 常见通用/新顶级
  biz: 830, shop: 825, store: 820, tech: 815, vip: 810, club: 805, blog: 800,
  cloud: 795, space: 790, fun: 785, live: 780, life: 775, world: 770, today: 765,
  news: 760, pro: 755, one: 750, link: 745, email: 740, network: 735, digital: 730,
  agency: 725, studio: 720, design: 715, media: 710, group: 705, ltd: 700,
  page: 695, plus: 690, red: 685, run: 680, team: 675, work: 670, zone: 665,
  // 常见国别/技术圈
  ca: 660, au: 655, nl: 650, ru: 645, br: 640, es: 635, it: 630, ch: 625,
  se: 620, no: 615, nz: 610, kr: 605, hk: 600, tw: 595, sg: 590, be: 585,
  at: 580, pl: 575, pt: 570, fi: 565, dk: 560, ie: 555, cz: 550, mx: 545,
  gg: 540, so: 535, to: 530, ly: 525, sh: 520, im: 515, is: 510, la: 505,
  ml: 500, tk: 495, ga: 490, cf: 485, gq: 480, cx: 475, ws: 470, vc: 465,
  fm: 460, am: 455, name: 450, mobi: 445, asia: 440, wiki: 435, ink: 430,
}

/** 标记为热门的前 N 个后缀 */
export const POPULAR_FLAG_COUNT = 30

/** 按热度分排序取前 N 个热门后缀 */
export function popularTlds(): string[] {
  return Object.entries(POPULARITY)
    .sort((a, b) => b[1] - a[1])
    .slice(0, POPULAR_FLAG_COUNT)
    .map(([t]) => t)
}
