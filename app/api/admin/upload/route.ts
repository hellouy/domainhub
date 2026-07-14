import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"

export const runtime = "nodejs"

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]

export async function POST(request: NextRequest) {
  // 仅登录后台管理员可上传
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "未提供文件" }, { status: 400 })

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "仅支持 PNG / JPG / SVG / WEBP / ICO 图片" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "图片不能超过 2MB" }, { status: 400 })
    }

    // 加时间戳前缀避免同名覆盖
    const safeName = `site/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const blob = await put(safeName, file, { access: "public" })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] 站点图片上传失败:", error)
    return NextResponse.json({ error: "上传失败，请重试" }, { status: 500 })
  }
}
