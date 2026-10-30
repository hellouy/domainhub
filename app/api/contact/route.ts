/**
 * POST /api/contact —— 联系表单提交
 */
import { NextResponse } from "next/server"
import { sendContactEmails } from "@/lib/email"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, subject, message } = body

    if (!name?.trim()) return NextResponse.json({ error: "姓名为必填项" }, { status: 400 })
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "请提供有效的邮箱地址" }, { status: 400 })
    }
    if (!subject?.trim()) return NextResponse.json({ error: "主题为必填项" }, { status: 400 })
    if (!message?.trim() || message.trim().length < 10) {
      return NextResponse.json({ error: "消息内容至少需要 10 个字符" }, { status: 400 })
    }

    const submittedAt = new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })

    const { adminOk, userOk, adminError, userError } = await sendContactEmails({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      submittedAt,
    })

    if (!adminOk && !userOk) {
      const detail = adminError ?? userError
      return NextResponse.json(
        {
          error: detail
            ? `邮件发送失败：${detail}`
            : "邮件发送失败，请稍后重试",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      message: "提交成功，我们会尽快回复您",
      emailSent: { admin: adminOk, user: userOk },
    })
  } catch (error) {
    console.error("[contact] Submit error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "提交失败，请稍后重试" },
      { status: 500 },
    )
  }
}
