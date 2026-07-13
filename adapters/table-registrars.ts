/**
 * 配置驱动的注册商适配器集合
 * ------------------------------------------------------------
 * 所有权: Data Team
 *
 * 这些注册商的价格页均为结构化 HTML 表格, 通过
 * createTableAdapter 工厂以纯配置接入(每家 ≈ 10 行配置)。
 * 接入新注册商: 复制一份配置改 URL/货币/列语义即可。
 */

import { createTableAdapter } from "./shared/table-adapter"

export const namesiloAdapter = createTableAdapter({
  slug: "namesilo",
  name: "NameSilo",
  website: "https://www.namesilo.com",
  currency: "USD",
  urls: ["https://www.namesilo.com/pricing"],
  columnOrder: ["register", "renew", "transfer"],
})

export const hoverAdapter = createTableAdapter({
  slug: "hover",
  name: "Hover",
  website: "https://www.hover.com",
  currency: "USD",
  urls: ["https://www.hover.com/tlds"],
  columnOrder: ["register", "renew", "transfer"],
})

export const onamaeAdapter = createTableAdapter({
  slug: "onamae",
  name: "\u304a\u540d\u524d.com",
  website: "https://www.onamae.com",
  currency: "JPY",
  urls: ["https://www.onamae.com/service/d-price/"],
  columnOrder: ["register", "renew", "transfer"],
})

export const internetbsAdapter = createTableAdapter({
  slug: "internetbs",
  name: "Internet.bs",
  website: "https://internetbs.net",
  currency: "USD",
  urls: ["https://internetbs.net/en/domain-name-registrations/pricelist.html"],
  columnOrder: ["register", "transfer", "renew"],
})

export const netimAdapter = createTableAdapter({
  slug: "netim",
  name: "Netim",
  website: "https://www.netim.com",
  currency: "EUR",
  numberFormat: "eu",
  urls: ["https://www.netim.com/en/domain-name/price-list"],
  columnOrder: ["register", "renew", "transfer"],
})

export const eurodnsAdapter = createTableAdapter({
  slug: "eurodns",
  name: "EuroDNS",
  website: "https://www.eurodns.com",
  currency: "EUR",
  urls: ["https://www.eurodns.com/domain-extensions"],
  columnOrder: ["register", "renew", "transfer"],
})

export const registercomAdapter = createTableAdapter({
  slug: "registercom",
  name: "Register.com",
  website: "https://www.register.com",
  currency: "USD",
  urls: ["https://www.register.com/domains/domain-pricing"],
  columnOrder: ["register", "renew", "transfer"],
})

export const metanameAdapter = createTableAdapter({
  slug: "metaname",
  name: "Metaname",
  website: "https://metaname.net",
  currency: "NZD",
  urls: ["https://metaname.net/pricing"],
  columnOrder: ["register", "renew", "transfer"],
})

export const infomaniakAdapter = createTableAdapter({
  slug: "infomaniak",
  name: "Infomaniak",
  website: "https://www.infomaniak.com",
  currency: "CHF",
  urls: ["https://www.infomaniak.com/en/domains/prices"],
  columnOrder: ["register", "renew", "transfer"],
})

export const loopiaAdapter = createTableAdapter({
  slug: "loopia",
  name: "Loopia",
  website: "https://www.loopia.se",
  currency: "SEK",
  numberFormat: "eu",
  urls: ["https://www.loopia.se/domain/"],
  columnOrder: ["register", "renew", "transfer"],
})

export const domeneshopAdapter = createTableAdapter({
  slug: "domeneshop",
  name: "Domeneshop",
  website: "https://domene.shop",
  currency: "NOK",
  numberFormat: "eu",
  urls: ["https://domene.shop/priser"],
  columnOrder: ["register", "renew", "transfer"],
})

export const netcupAdapter = createTableAdapter({
  slug: "netcup",
  name: "Netcup",
  website: "https://www.netcup.com",
  currency: "EUR",
  numberFormat: "eu",
  urls: ["https://www.netcup.com/en/domain"],
  columnOrder: ["register", "renew", "transfer"],
})

export const lwsAdapter = createTableAdapter({
  slug: "lws",
  name: "LWS",
  website: "https://www.lws.fr",
  currency: "EUR",
  numberFormat: "fr",
  urls: ["https://www.lws.fr/nom-de-domaine.php"],
  columnOrder: ["register", "renew", "transfer"],
})

export const amenAdapter = createTableAdapter({
  slug: "amen",
  name: "Amen",
  website: "https://www.amen.fr",
  currency: "EUR",
  numberFormat: "fr",
  urls: ["https://www.amen.fr/noms-de-domaine/"],
  columnOrder: ["register", "renew", "transfer"],
})

export const arubaAdapter = createTableAdapter({
  slug: "aruba",
  name: "Aruba Domains",
  website: "https://www.aruba.it",
  currency: "EUR",
  numberFormat: "eu",
  urls: ["https://www.aruba.it/domini/registrazione-dominio.aspx"],
  columnOrder: ["register", "renew", "transfer"],
})

export const transipAdapter = createTableAdapter({
  slug: "transip",
  name: "TransIP",
  website: "https://www.transip.nl",
  currency: "EUR",
  numberFormat: "eu",
  urls: ["https://www.transip.nl/domein-registreren/"],
  columnOrder: ["register", "renew", "transfer"],
})

export const openproviderAdapter = createTableAdapter({
  slug: "openprovider",
  name: "Openprovider",
  website: "https://www.openprovider.com",
  currency: "EUR",
  urls: ["https://www.openprovider.com/domain-price-list"],
  columnOrder: ["register", "renew", "transfer"],
})
