// 通用价格表提取器 —— 在 agent-browser eval 中执行
// 返回 JSON: [{ tld, register, renew, transfer }]
// 策略: 优先 <table>, 回退到常见 div 网格布局
(() => {
  const out = new Map()
  const priceRe = /(\d{1,3}(?:[.,\s\u00a0']\d{3})*(?:[.,]\d{1,2})?)/
  const tldRe = /^\.?([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})$/i

  const parseNum = (t) => {
    if (!t) return null
    let s = t.replace(/[^\d.,\s\u00a0']/g, '').trim()
    if (!s) return null
    // 判断小数分隔符: 最后出现的 . 或 ,
    // 关键规则: 分隔符后正好 3 位数字视为千位分隔符(如 1,298 → 1298)
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    const sep = Math.max(lastDot, lastComma)
    const digitsAfter = sep >= 0 ? s.slice(sep + 1).replace(/\D/g, '').length : 0
    if (sep >= 0 && digitsAfter === 3) {
      // 千位分隔符
      s = s.replace(/[.,\s\u00a0']/g, '')
    } else if (lastComma > lastDot) {
      s = s.replace(/[.\s\u00a0']/g, '').replace(',', '.')
    } else {
      s = s.replace(/[,\s\u00a0']/g, '')
    }
    const v = parseFloat(s)
    return Number.isFinite(v) && v > 0 && v < 1000000 ? Math.round(v * 100) / 100 : null
  }

  // 1) 表格
  for (const tr of document.querySelectorAll('table tr')) {
    const cells = [...tr.querySelectorAll('td,th')].map((c) => c.innerText.trim())
    if (cells.length < 2) continue
    let tld = null
    let tldIdx = -1
    for (let i = 0; i < Math.min(cells.length, 3); i++) {
      const c = cells[i].split('\n')[0].trim().toLowerCase()
      const m = c.match(tldRe)
      if (m && (c.startsWith('.') || i === 0) && !/^\d+$/.test(m[1])) {
        tld = m[1].toLowerCase()
        tldIdx = i
        break
      }
    }
    if (!tld || out.has(tld)) continue
    const nums = []
    for (let i = tldIdx + 1; i < cells.length; i++) {
      const v = parseNum(cells[i])
      if (v !== null) nums.push(v)
    }
    if (nums.length === 0) continue
    out.set(tld, { tld, register: nums[0] ?? null, renew: nums[1] ?? null, transfer: nums[2] ?? null })
  }

  // 2) div 网格回退(每行一个容器, 内含 .tld 文本与价格)
  if (out.size < 10) {
    const candidates = document.querySelectorAll('[class*="row"],[class*="item"],[class*="tld"],li')
    for (const el of candidates) {
      const text = el.innerText || ''
      if (text.length > 300) continue
      const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
      if (lines.length < 2) continue
      const first = lines[0].toLowerCase()
      const m = first.match(/^\.([a-z0-9-]{2,20}(?:\.[a-z0-9-]{2,15}){0,2})$/)
      if (!m) continue
      const tld = m[1]
      if (out.has(tld)) continue
      const nums = []
      for (let i = 1; i < lines.length; i++) {
        const pm = lines[i].match(priceRe)
        if (pm && /[\d]/.test(lines[i]) && lines[i].length < 40) {
          const v = parseNum(lines[i])
          if (v !== null) nums.push(v)
        }
      }
      if (nums.length === 0) continue
      out.set(tld, { tld, register: nums[0] ?? null, renew: nums[1] ?? null, transfer: nums[2] ?? null })
    }
  }

  return JSON.stringify([...out.values()])
})()
