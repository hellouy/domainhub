/**
 * 极简 Markdown → HTML 渲染器(自包含,XSS 安全)。
 *
 * 设计:先整体 HTML 转义,再做受控的 Markdown 语法替换,
 * 因此正文中任何 <script>/onerror 等原始 HTML 都会被转义为文本,
 * 从根本上杜绝注入。覆盖文章生成常用的语法子集:
 * 标题、段落、粗体/斜体、行内代码、代码块、链接、无序/有序列表、引用、分隔线。
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** 仅允许 http(s)、mailto 与站内相对链接,阻断 javascript: 等危险协议 */
function sanitizeUrl(raw: string): string {
  const url = raw.trim()
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(url)) return url
  return "#"
}

/** 行内元素:粗体、斜体、行内代码、链接 */
function renderInline(text: string): string {
  let out = text
  // 行内代码优先,避免内部被其它规则改写
  const codeTokens: string[] = []
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`
    codeTokens.push(`<code class="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">${escapeHtml(code)}</code>`)
    return token
  })
  // 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const href = sanitizeUrl(url)
    const external = /^https?:\/\//i.test(href)
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : ""
    return `<a href="${escapeHtml(href)}" class="text-primary underline underline-offset-2 hover:opacity-80"${attrs}>${label}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
  // 还原行内代码
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx: string) => codeTokens[Number(idx)] ?? "")
  return out
}

export function renderMarkdown(markdown: string): string {
  const src = markdown.replace(/\r\n?/g, "\n").trim()
  if (!src) return ""

  const lines = src.split("\n")
  const html: string[] = []
  let i = 0

  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) return
    html.push(`<p class="leading-relaxed">${renderInline(buffer.join(" "))}</p>`)
    buffer.length = 0
  }

  const paragraph: string[] = []

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行:结束段落
    if (trimmed === "") {
      flushParagraph(paragraph)
      i += 1
      continue
    }

    // 代码块 ```
    if (trimmed.startsWith("```")) {
      flushParagraph(paragraph)
      const lang = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束 ```
      const langClass = lang ? ` data-lang="${escapeHtml(lang)}"` : ""
      html.push(
        `<pre class="overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code${langClass} class="font-mono">${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      )
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph(paragraph)
      html.push('<hr class="my-6 border-border" />')
      i += 1
      continue
    }

    // 标题
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flushParagraph(paragraph)
      const level = heading[1].length
      const sizes: Record<number, string> = {
        1: "text-2xl font-bold mt-8 mb-3",
        2: "text-xl font-bold mt-8 mb-3",
        3: "text-lg font-semibold mt-6 mb-2",
        4: "text-base font-semibold mt-4 mb-2",
        5: "text-sm font-semibold mt-3 mb-1",
        6: "text-sm font-semibold mt-3 mb-1",
      }
      html.push(`<h${level} class="${sizes[level]}">${renderInline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    // 引用
    if (trimmed.startsWith(">")) {
      flushParagraph(paragraph)
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""))
        i += 1
      }
      html.push(
        `<blockquote class="my-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">${renderInline(quoteLines.join(" "))}</blockquote>`,
      )
      continue
    }

    // 无序列表
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph(paragraph)
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(`<li class="ml-5 list-disc">${renderInline(lines[i].trim().replace(/^[-*+]\s+/, ""))}</li>`)
        i += 1
      }
      html.push(`<ul class="my-3 space-y-1">${items.join("")}</ul>`)
      continue
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph(paragraph)
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li class="ml-5 list-decimal">${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`)
        i += 1
      }
      html.push(`<ol class="my-3 space-y-1">${items.join("")}</ol>`)
      continue
    }

    paragraph.push(trimmed)
    i += 1
  }

  flushParagraph(paragraph)
  return html.join("\n")
}
