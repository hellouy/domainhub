import type { Locale } from "@/lib/i18n"

/**
 * 注册商双语介绍(按 slug)。
 * - 数据库里原有中文描述,这里补齐英文并统一维护双语版本。
 * - 未收录的 slug 回退到数据库描述(中文场景)或空串(英文场景)。
 */
export const REGISTRAR_CONTENT: Record<string, { zh: string; en: string }> = {
  "101domain": {
    zh: "美国老牌国际域名注册商，覆盖 250 余个后缀，擅长国别域名与小语种市场，界面专业，价格整体偏高。",
    en: "A veteran US-based international registrar covering over 250 extensions, strong on ccTLDs and niche markets with a professional interface and generally higher prices.",
  },
  "22cn": {
    zh: "国内域名注册服务商，主打 .cn 等中文后缀与建站、企业邮箱等配套服务，价格以人民币计价。",
    en: "A Chinese registrar focused on .cn and related extensions, bundling website building and business email, priced in CNY.",
  },
  "59cn": {
    zh: "国内域名注册商，提供 .com、.cn 等常用后缀注册与续费，支持国内解析与备案场景。",
    en: "A Chinese registrar offering .com, .cn and other common extensions with domestic DNS and ICP filing support.",
  },
  active24: {
    zh: "捷克注册商，同时提供主机与域名服务，主要覆盖 .cz 等中欧后缀，价格以捷克克朗计价。",
    en: "A Czech registrar offering hosting alongside domains, mainly covering .cz and Central European extensions, priced in CZK.",
  },
  activedomains: {
    zh: "面向俄语市场的域名注册商，后缀覆盖较广，价格以卢布计价。",
    en: "A domain registrar serving the Russian-speaking market with broad extension coverage, priced in RUB.",
  },
  afrihost: {
    zh: "南非主流主机与域名服务商，覆盖 .co.za 等非洲后缀及主流 gTLD，价格以南非兰特计价。",
    en: "A leading South African hosting and domain provider covering .co.za and African extensions plus major gTLDs, priced in ZAR.",
  },
  afriregister: {
    zh: "专注非洲市场的注册商，覆盖约 140 个国别后缀，适合需要非洲本地域名的用户，价格以欧元计价。",
    en: "A registrar focused on African markets with around 140 ccTLD extensions, suited to users needing African local domains, priced in EUR.",
  },
  aliyun: {
    zh: "国内最大域名注册商，支持备案与国内解析生态，.cn 等后缀价格有优势，控制台功能完整。",
    en: "China's largest registrar, with ICP filing support and a domestic DNS ecosystem, competitive .cn pricing and a full-featured console.",
  },
  "alldomains-uz": {
    zh: "乌兹别克斯坦注册商，覆盖 400 余个后缀，主打 .uz 等中亚域名，价格以苏姆计价。",
    en: "An Uzbek registrar covering over 400 extensions, strong on .uz and Central Asian domains, priced in UZS.",
  },
  aruba: {
    zh: "意大利 Aruba 旗下域名服务，覆盖 360 余个后缀，兼顾 .it 等欧洲后缀与主机业务，价格以欧元计价。",
    en: "Part of Italy's Aruba group, covering over 360 extensions with .it and European ccTLDs alongside hosting, priced in EUR.",
  },
  atakdomain: {
    zh: "土耳其注册商，后缀覆盖近千个，价格以美元计价，适合批量注册与投资组合管理。",
    en: "A Turkish registrar covering nearly a thousand extensions, priced in USD and suited to bulk registration and portfolio management.",
  },
  barbero: {
    zh: "英国小型域名注册商，覆盖后缀较少，面向本地用户提供注册与续费服务，价格以欧元计价。",
    en: "A small UK registrar with limited extension coverage, serving local users with registration and renewal, priced in EUR.",
  },
  blacknight: {
    zh: "爱尔兰老牌主机与域名商，覆盖 .ie 等欧洲后缀及主流 gTLD，客服口碑良好，价格以欧元计价。",
    en: "A long-established Irish hosting and domain provider covering .ie and European extensions plus major gTLDs, known for good support, priced in EUR.",
  },
  ccireg: {
    zh: "小型专业注册商，后缀覆盖有限，主要面向特定细分市场提供域名注册服务。",
    en: "A small specialist registrar with limited extension coverage, serving a specific niche market.",
  },
  cloudflare: {
    zh: "以注册局批发价提供域名服务，大多数常见后缀不额外加价。域名与 Cloudflare DNS、安全及网络服务集中管理，并提供 WHOIS 隐私保护与 DNSSEC，适合已经使用 Cloudflare 的网站。",
    en: "Domains are offered at registry wholesale pricing, with no markup on most common extensions. Registration works alongside Cloudflare DNS, security, and network services, with WHOIS privacy and DNSSEC for sites already using its platform.",
  },
  cloudns: {
    zh: "拉脱维亚 DNS 服务商，域名注册覆盖超千个后缀，与免费 DNS 解析深度整合，价格以欧元计价。",
    en: "A Latvian DNS provider offering domain registration across 1,000+ extensions, tightly integrated with free DNS hosting, priced in EUR.",
  },
  cndns: {
    zh: "中国频道旗下域名注册商，提供常用中英文后缀注册与解析服务，价格以人民币计价。",
    en: "A registrar under China Channel offering common Chinese and international extensions with DNS services, priced in CNY.",
  },
  connectreseller: {
    zh: "面向经销商的域名注册平台，提供 650 余个后缀的批发接入与白标服务，价格以美元计价。",
    en: "A reseller-oriented domain platform offering wholesale access to 650+ extensions with white-label services, priced in USD.",
  },
  cosmotown: {
    zh: "美国平价注册商，覆盖 240 余个后缀，续费价格稳定、附加费少，适合长期持有域名。",
    en: "A budget US registrar covering 240+ extensions with stable renewals and few add-on fees, suited to long-term domain holding.",
  },
  cpi: {
    zh: "日本注册商，主要覆盖 .jp 等日本后缀，面向本地企业与个人用户，价格以日元计价。",
    en: "A Japanese registrar mainly covering .jp and other Japanese extensions for local businesses and individuals, priced in JPY.",
  },
  danesco: {
    zh: "小型国际注册商，后缀覆盖约数十个，提供基础的注册与续费服务，价格以美元计价。",
    en: "A small international registrar covering a few dozen extensions with basic registration and renewal, priced in USD.",
  },
  directnic: {
    zh: "美国老牌注册商，覆盖 500 余个后缀，提供域名与主机捆绑方案，价格以美元计价。",
    en: "A veteran US registrar covering 500+ extensions with bundled domain and hosting plans, priced in USD.",
  },
  domaincostclub: {
    zh: "美国会员制注册商，主打接近成本的定价与批量管理工具，适合持有多域名的用户。",
    en: "A US membership-based registrar focused on near-cost pricing and bulk management tools, suited to users holding many domains.",
  },
  domeneshop: {
    zh: "挪威注册商，主要覆盖 .no 等北欧后缀，提供主机与域名一体化服务，价格以挪威克朗计价。",
    en: "A Norwegian registrar mainly covering .no and Nordic extensions with integrated hosting, priced in NOK.",
  },
  dotology: {
    zh: "美国注册商，覆盖 330 余个后缀，提供批量注册与管理工具，价格以美元计价。",
    en: "A US registrar covering 330+ extensions with bulk registration and management tools, priced in USD.",
  },
  dotwee: {
    zh: "国际注册商，后缀覆盖 460 余个，兼顾 gTLD 与国别域名，价格以美元计价。",
    en: "An international registrar covering 460+ extensions across gTLDs and ccTLDs, priced in USD.",
  },
  dreamhost: {
    zh: "美国老牌主机商，域名注册与主机、邮箱、建站工具捆绑，多数域名提供免费隐私保护，价格以美元计价。",
    en: "A veteran US host bundling domain registration with hosting, email and site tools, with free privacy on many domains, priced in USD.",
  },
  dynadot: {
    zh: "价格结构清晰、续费价格相对稳定，支持中文界面与域名批量管理。多数符合条件的域名可使用免费的隐私保护，适合希望用熟悉语言管理多个域名的用户。",
    en: "Clear pricing and relatively steady renewals, with a Chinese-language interface and bulk domain management. Free privacy protection is available for many eligible domains, making it a practical choice for managing several names.",
  },
  easyspace: {
    zh: "英国注册商，覆盖 500 余个后缀，提供域名与主机套餐，价格以英镑计价。",
    en: "A UK registrar covering 500+ extensions with domain and hosting packages, priced in GBP.",
  },
  epik: {
    zh: "美国注册商，后缀覆盖 700 余个，提供域名投资与托管工具，价格以美元计价。",
    en: "A US registrar covering 700+ extensions with domain investing and escrow tools, priced in USD.",
  },
  eurodns: {
    zh: "卢森堡注册商，专注欧洲市场，覆盖 .eu 及主流国别后缀，提供企业级管理功能，价格以欧元计价。",
    en: "A Luxembourg registrar focused on Europe, covering .eu and major ccTLDs with enterprise-grade management, priced in EUR.",
  },
  exabytes: {
    zh: "马来西亚主机与域名商，覆盖 .com.my 等东南亚后缀及主流 gTLD，价格以马来西亚林吉特计价。",
    en: "A Malaysian hosting and domain provider covering .com.my and Southeast Asian extensions plus major gTLDs, priced in MYR.",
  },
  fabulous: {
    zh: "澳大利亚注册商，主要面向域名投资与批量持有场景，后缀覆盖 500 余个，价格以美元计价。",
    en: "An Australian registrar oriented toward domain investing and bulk holdings, covering 500+ extensions, priced in USD.",
  },
  forpsi: {
    zh: "捷克主机与域名商，覆盖 .cz 等中欧后缀，提供主机、VPS 与域名一体化服务，价格以捷克克朗计价。",
    en: "A Czech hosting and domain provider covering .cz and Central European extensions with hosting, VPS and domains, priced in CZK.",
  },
  gandi: {
    zh: "法国注册商，以简洁界面与隐私友好著称，提供免费 WHOIS 隐私与邮箱，价格整体中等偏上。",
    en: "A French registrar known for a clean interface and privacy focus, offering free WHOIS privacy and email, with mid-to-upper pricing.",
  },
  gatehills: {
    zh: "国际注册商，后缀覆盖 430 余个，提供注册、转入与批量管理，价格以美元计价。",
    en: "An international registrar covering 430+ extensions with registration, transfer and bulk management, priced in USD.",
  },
  gname: {
    zh: "面向中文用户的国际注册商，覆盖 80 余个常用后缀，提供批量管理与 API 接口，价格以美元计价。",
    en: "An international registrar serving Chinese users with 80+ common extensions, bulk management and API access, priced in USD.",
  },
  godaddy: {
    zh: "全球最大域名注册商，产品线丰富，首年常有低价促销，续费与附加服务价格偏高。",
    en: "The world's largest registrar with a broad product line and frequent low first-year promotions, though renewals and add-ons run high.",
  },
  gzidc: {
    zh: "国肇数据旗下注册商，主要覆盖 .cn 等国内后缀，提供本地化解析与备案配套，价格以人民币计价。",
    en: "A registrar under GZIDC mainly covering .cn and domestic extensions with local DNS and filing support, priced in CNY.",
  },
  hostafrica: {
    zh: "非洲主机与域名商，主要覆盖 .co.za 等非洲后缀，面向本地企业与个人，价格以南非兰特计价。",
    en: "An African hosting and domain provider mainly covering .co.za and African extensions for local users, priced in ZAR.",
  },
  hostinger: {
    zh: "立陶宛主机商，域名常与建站套餐捆绑，支持免费 WHOIS 隐私，价格以美元计价，续费略高于首年。",
    en: "A Lithuanian host bundling domains with site plans and free WHOIS privacy, priced in USD with renewals slightly above first-year rates.",
  },
  "hostingkr": {
    zh: "韩国主机与域名商，主要覆盖 .kr 等韩国后缀，面向本地用户提供注册与解析服务，价格以韩元计价。",
    en: "A Korean hosting and domain provider mainly covering .kr and Korean extensions for local users, priced in KRW.",
  },
  hostpoint: {
    zh: "瑞士主机与域名商，后缀覆盖超千个，提供瑞士本地化服务与合规支持，价格以瑞士法郎计价。",
    en: "A Swiss hosting and domain provider covering 1,000+ extensions with local services and compliance support, priced in CHF.",
  },
  hostripples: {
    zh: "印度注册商，覆盖 gTLD 与国别后缀约 24 个，面向本地市场，价格以印度卢比计价。",
    en: "An Indian registrar covering about 24 gTLD and ccTLD extensions for the local market, priced in INR.",
  },
  icdsoft: {
    zh: "保加利亚主机与域名商，后缀覆盖较少但精选常用项，以稳定主机服务著称，价格以美元计价。",
    en: "A Bulgarian hosting and domain provider with a small curated set of extensions, known for reliable hosting, priced in USD.",
  },
  idwebhost: {
    zh: "印尼主机与域名商，覆盖 .id 等东南亚后缀及主流 gTLD，价格以印尼盾计价。",
    en: "An Indonesian hosting and domain provider covering .id and Southeast Asian extensions plus major gTLDs, priced in IDR.",
  },
  imena: {
    zh: "乌克兰注册商，覆盖 .ua 等本地后缀及主流 gTLD，提供本地化支持，价格以格里夫纳计价。",
    en: "A Ukrainian registrar covering .ua and other local extensions plus major gTLDs, with local support and UAH pricing.",
  },
  interserver: {
    zh: "美国主机与域名商，域名注册常与主机方案捆绑，覆盖 500 余个后缀，价格以美元计价。",
    en: "A US hosting and domain provider often bundling domains with hosting plans, covering 500+ extensions, priced in USD.",
  },
  inwx: {
    zh: "德国注册商，后缀覆盖超两千个，提供 API 与域名自动化管理，适合技术型用户，价格以欧元/美元计价。",
    en: "A German registrar covering 2,000+ extensions with API and automated domain management, suited to technical users, priced in EUR/USD.",
  },
  istanco: {
    zh: "小型欧洲注册商，后缀覆盖约数十个，提供基础注册与续费服务，价格以欧元计价。",
    en: "A small European registrar covering a few dozen extensions with basic registration and renewal, priced in EUR.",
  },
  iwantmyname: {
    zh: "新西兰注册商，覆盖 660 余个后缀，界面简洁、强调易用性，适合个人与小团队。",
    en: "A New Zealand registrar covering 660+ extensions with a clean, ease-of-use focus, suited to individuals and small teams.",
  },
  joker: {
    zh: "德国老牌注册商，覆盖近 600 个后缀，提供稳定接口与企业级管理，价格以美元计价。",
    en: "A veteran German registrar covering nearly 600 extensions with stable interfaces and enterprise management, priced in USD.",
  },
  julyname: {
    zh: "国内域名注册与交易服务商，覆盖 600 余个后缀，支持批量管理与域名交易，价格以人民币计价。",
    en: "A Chinese domain registration and trading service covering 600+ extensions with bulk management and marketplace features, priced in CNY.",
  },
  juming: {
    zh: "国内知名域名交易与注册平台，覆盖 120 余个后缀，适合域名投资与批量持有。",
    en: "A well-known Chinese domain trading and registration platform covering 120+ extensions, suited to investing and bulk holdings.",
  },
  keliweb: {
    zh: "意大利主机与域名商，覆盖主流 gTLD 与欧洲后缀，提供主机、VPS 与域名一体化服务，价格以欧元计价。",
    en: "An Italian hosting and domain provider covering major gTLDs and European extensions with hosting, VPS and domains, priced in EUR.",
  },
  kouming: {
    zh: "国际域名注册与交易平台，覆盖近 400 个后缀，面向域名投资与批量管理，价格以美元计价。",
    en: "An international domain registration and trading platform covering nearly 400 extensions for investing and bulk management, priced in USD.",
  },
  krystal: {
    zh: "英国主机与域名商，主要覆盖 .uk 等英国后缀及常用 gTLD，强调客服质量，价格以英镑计价。",
    en: "A UK hosting and domain provider mainly covering .uk and common gTLDs with a support-quality focus, priced in GBP.",
  },
  lcn: {
    zh: "英国注册商，后缀覆盖较少但集中于常用项，提供域名与网站服务，价格以英镑计价。",
    en: "A UK registrar with a small, common-extension focus offering domains and website services, priced in GBP.",
  },
  loopia: {
    zh: "瑞典主机与域名商，主要覆盖 .se 等北欧后缀，提供本地化服务，价格以瑞典克朗计价。",
    en: "A Swedish hosting and domain provider mainly covering .se and Nordic extensions with local services, priced in SEK.",
  },
  lws: {
    zh: "法国主机与域名商，覆盖 300 余个后缀，常与建站与邮箱套餐捆绑，价格以欧元计价。",
    en: "A French hosting and domain provider covering 300+ extensions often bundled with site and email plans, priced in EUR.",
  },
  mchost: {
    zh: "面向俄语市场的注册商，覆盖 370 余个后缀，提供主机与域名服务，价格以卢布计价。",
    en: "A registrar serving the Russian-speaking market covering 370+ extensions with hosting and domains, priced in RUB.",
  },
  metaname: {
    zh: "新西兰注册商，覆盖 90 余个后缀，提供 API 与自动化管理，适合技术用户，价格以新西兰元计价。",
    en: "A New Zealand registrar covering 90+ extensions with API and automation, suited to technical users, priced in NZD.",
  },
  "muumuu-domain": {
    zh: "日本 GMO 旗下注册商，覆盖 400 余个后缀，界面友好，常与日本主机服务捆绑，价格以日元计价。",
    en: "A GMO-backed Japanese registrar covering 400+ extensions with a friendly interface, often bundled with Japanese hosting, priced in JPY.",
  },
  namecheap: {
    zh: "老牌注册商，首年促销力度大，免费终身 WHOIS 隐私保护，续费价格中等。",
    en: "A long-established registrar with strong first-year deals and free lifetime WHOIS privacy, with mid-range renewals.",
  },
  namecom: {
    zh: "界面友好的美国注册商，常有促销活动，提供免费 WHOIS 隐私与较完整的 DNS 管理。",
    en: "A user-friendly US registrar that frequently runs promotions, offering free WHOIS privacy and solid DNS management.",
  },
  namegear: {
    zh: "日本注册商，后缀覆盖较少，主要面向本地用户提供域名与配套服务，价格以日元计价。",
    en: "A Japanese registrar with limited extension coverage, mainly serving local users with domains and related services, priced in JPY.",
  },
  namesilo: {
    zh: "美国注册商，以低价与免费终身 WHOIS 隐私著称，续费价格稳定，控制台简洁实用。",
    en: "A US registrar known for low prices and free lifetime WHOIS privacy, with stable renewals and a clean console.",
  },
  nameslink: {
    zh: "新兴国际注册商，价格透明、界面简洁，覆盖 200 个后缀，提供注册、续费与转入一站式服务。",
    en: "A newer international registrar with transparent pricing and a clean interface, covering 200 extensions with registration, renewal and transfer.",
  },
  networksolutions: {
    zh: "美国历史最悠久的注册商之一，品牌信誉高，但价格与续费整体偏高。",
    en: "One of the oldest US registrars with strong brand trust, though prices and renewals run high.",
  },
  netzone: {
    zh: "瑞士注册商，后缀覆盖超千个，提供域名与主机服务，价格以美元计价。",
    en: "A Swiss registrar covering 1,000+ extensions with domain and hosting services, priced in USD.",
  },
  nicnames: {
    zh: "国际注册商，覆盖近 600 个后缀，提供批量注册与管理工具，价格以美元计价。",
    en: "An international registrar covering nearly 600 extensions with bulk registration and management tools, priced in USD.",
  },
  nordname: {
    zh: "芬兰家族经营的欧洲注册商，价格透明、含免费 WHOIS 隐私与 Anycast DNS，覆盖 400 余个后缀，以实惠著称。",
    en: "A family-owned European registrar from Finland with transparent pricing, free WHOIS privacy and Anycast DNS across 400+ extensions, known for affordability.",
  },
  onamae: {
    zh: "日本最大注册商之一，覆盖 440 余个后缀，常与日本主机和建站服务捆绑，促销活动多，价格以日元计价。",
    en: "One of Japan's largest registrars covering 440+ extensions, often bundled with Japanese hosting and site services with frequent promotions, priced in JPY.",
  },
  one: {
    zh: "丹麦主机与域名商，域名常与建站与邮箱套餐捆绑，覆盖常用后缀，价格以英镑计价。",
    en: "A Danish hosting and domain provider bundling domains with site and email plans across common extensions, priced in GBP.",
  },
  onlydomains: {
    zh: "新西兰国际注册商，覆盖 850 余个后缀，国别域名资源丰富，价格以美元计价。",
    en: "A New Zealand international registrar covering 850+ extensions with strong ccTLD coverage, priced in USD.",
  },
  openprovider: {
    zh: "荷兰批发注册商，覆盖超两千个后缀，面向经销商与大型域名组合，提供 API 与白标服务。",
    en: "A Dutch wholesale registrar covering 2,000+ extensions for resellers and large portfolios, with API and white-label services.",
  },
  osir: {
    zh: "小型国际注册商，后缀覆盖有限，提供基础注册与续费服务，价格以美元计价。",
    en: "A small international registrar with limited extension coverage offering basic registration and renewal, priced in USD.",
  },
  ovhcloud: {
    zh: "法国云服务商，域名与云主机、VPS 深度整合，后缀覆盖 900 余个，价格以欧元计价。",
    en: "A French cloud provider integrating domains with cloud hosting and VPS across 900+ extensions, priced in EUR.",
  },
  pavietnam: {
    zh: "越南本地注册商，覆盖 .vn 全家族及主流 gTLD，提供本地化支持，价格以越南盾计价。",
    en: "A Vietnamese registrar covering the full .vn family plus major gTLDs with local support, priced in VND.",
  },
  porkbun: {
    zh: "价格透明的美国独立注册商，赠送 WHOIS 隐私与 SSL 证书，首年与续费价差小，界面简洁。",
    en: "A transparent US independent registrar bundling free WHOIS privacy and SSL, with small gaps between first-year and renewal pricing and a clean interface.",
  },
  pskz: {
    zh: "哈萨克斯坦主机与域名商，主要覆盖 .kz 等中亚后缀，面向本地用户，价格以坚戈计价。",
    en: "A Kazakh hosting and domain provider mainly covering .kz and Central Asian extensions for local users, priced in KZT.",
  },
  quyu: {
    zh: "国内域名注册商，覆盖近千个后缀，价格以人民币计价，适合需要大量国别与中文 IDN 后缀的用户。",
    en: "A Chinese registrar covering nearly 1,000 extensions priced in CNY, suited to users needing many ccTLDs and Chinese IDN extensions.",
  },
  rebel: {
    zh: "Tucows 旗下加拿大零售注册商，提供公开定价接口与 USD/CAD 双币种报价，覆盖 470 余个后缀。",
    en: "A Canadian retail registrar under Tucows with a public pricing API and USD/CAD quotes across 470+ extensions.",
  },
  register4less: {
    zh: "美国平价注册商，采用会员制固定定价，多数域名含免费 WHOIS 隐私，覆盖 420 余个后缀。",
    en: "A US budget registrar with flat membership pricing and free WHOIS privacy on most domains across 420+ extensions.",
  },
  regtons: {
    zh: "国际注册商，后缀覆盖超千个，提供批量注册与域名组合管理，价格以美元计价。",
    en: "An international registrar covering 1,000+ extensions with bulk registration and portfolio management, priced in USD.",
  },
  rumahweb: {
    zh: "印尼主机与域名商，覆盖 .id 等本地后缀及主流 gTLD，面向本地企业与个人，价格以印尼盾计价。",
    en: "An Indonesian hosting and domain provider covering .id and local extensions plus major gTLDs, priced in IDR.",
  },
  spaceship: {
    zh: "Namecheap 旗下新品牌，主打低价与现代化管理面板，首年价格优势明显，覆盖 460 余个后缀。",
    en: "Namecheap's newer brand focused on low prices and a modern dashboard, with strong first-year pricing across 460+ extensions.",
  },
  stardomain: {
    zh: "日本注册商，后缀覆盖约 50 个，主要面向本地用户提供域名与配套服务，价格以日元计价。",
    en: "A Japanese registrar covering about 50 extensions mainly serving local users with domains and related services, priced in JPY.",
  },
  tierra: {
    zh: "国际注册商，覆盖 350 余个后缀，提供注册、续费与转入服务，价格以美元计价。",
    en: "An international registrar covering 350+ extensions with registration, renewal and transfer services, priced in USD.",
  },
  truehost: {
    zh: "肯尼亚主机与域名商，覆盖 .co.ke 等非洲后缀及主流 gTLD，面向本地市场，价格以肯尼亚先令计价。",
    en: "A Kenyan hosting and domain provider covering .co.ke and African extensions plus major gTLDs, priced in KES.",
  },
  "truehost-cloud": {
    zh: "Truehost 国际站，采用 WHMCS 平台，覆盖 560 个后缀的注册、续费与转入，价格以美元计价。",
    en: "Truehost's international site on WHMCS, covering 560 extensions for registration, renewal and transfer, priced in USD.",
  },
  ueepa: {
    zh: "巴西本地注册商，覆盖 .br 家族及主流 gTLD，提供本地化支持与解析服务，价格以雷亚尔计价。",
    en: "A Brazilian registrar covering the .br family plus major gTLDs with local support and DNS, priced in BRL.",
  },
  ukrnames: {
    zh: "乌克兰注册商，覆盖 .ua 等本地后缀及主流 gTLD，提供注册、续费与转入服务，价格以格里夫纳计价。",
    en: "A Ukrainian registrar covering .ua and local extensions plus major gTLDs with registration, renewal and transfer, priced in UAH.",
  },
  ultahost: {
    zh: "美国主机与域名商，域名常与主机方案捆绑，覆盖 530 余个后缀，价格以美元计价。",
    en: "A US hosting and domain provider often bundling domains with hosting plans across 530+ extensions, priced in USD.",
  },
  "value-domain": {
    zh: "日本注册商，覆盖 480 余个后缀，价格实惠，常与日本主机服务配合使用，以日元计价。",
    en: "A Japanese registrar covering 480+ extensions with affordable pricing, often used alongside Japanese hosting, priced in JPY.",
  },
  vsys: {
    zh: "国际注册商，覆盖 380 余个后缀，提供批量注册与管理工具，价格以美元计价。",
    en: "An international registrar covering 380+ extensions with bulk registration and management tools, priced in USD.",
  },
  westcn: {
    zh: "西部数码旗下注册商，覆盖 110 余个常用后缀，提供主机与建站配套，价格以人民币计价。",
    en: "A registrar under West.cn covering 110+ common extensions with hosting and site tools, priced in CNY.",
  },
  whc: {
    zh: "加拿大主机与域名商，覆盖 .ca 等本地后缀及主流 gTLD，面向本地企业与个人，价格以加元计价。",
    en: "A Canadian hosting and domain provider covering .ca and local extensions plus major gTLDs, priced in CAD.",
  },
  whogohost: {
    zh: "尼日利亚主机与域名商，覆盖 .ng 等非洲后缀及主流 gTLD，面向本地市场，价格以奈拉计价。",
    en: "A Nigerian hosting and domain provider covering .ng and African extensions plus major gTLDs, priced in NGN.",
  },
  wpx: {
    zh: "英国高性能主机商，域名与托管 WordPress 套餐捆绑，覆盖 40 个精选后缀，价格以美元计价。",
    en: "A UK high-performance host bundling domains with managed WordPress plans across 40 curated extensions, priced in USD.",
  },
  xserver: {
    zh: "日本主机与域名商，覆盖 270 余个后缀，常与日本主机和建站服务捆绑，价格以日元计价。",
    en: "A Japanese hosting and domain provider covering 270+ extensions, often bundled with Japanese hosting and site services, priced in JPY.",
  },
  zcom: {
    zh: "日本 GMO 旗下注册商，覆盖 350 余个后缀，部分热门后缀首年有捆绑低价促销，价格以美元计价。",
    en: "A GMO-backed Japanese registrar covering 350+ extensions, with bundled low first-year promotions on some popular extensions, priced in USD.",
  },
  zwcn: {
    zh: "国内域名注册商，主要覆盖 .cn 等国内后缀，提供本地化解析与备案配套，价格以人民币计价。",
    en: "A Chinese registrar mainly covering .cn and domestic extensions with local DNS and filing support, priced in CNY.",
  },
}

/** 取本地化描述:英文缺失时回退空串,中文回退数据库描述 */
export function registrarDescription(slug: string, dbDesc: string, locale: Locale): string {
  const entry = REGISTRAR_CONTENT[slug]
  if (locale === "en") return entry?.en ?? ""

  const fallbackDescription = dbDesc.trim()
  if (/^(今日)?采集自动入库[。.]?$/.test(fallbackDescription)) return entry?.zh ?? ""
  return entry?.zh ?? fallbackDescription
}