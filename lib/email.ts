/**
 * Resend 邮件服务封装
 * 两个邮件模板：管理员通知、用户确认
 */
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const DOMAIN = process.env.RESEND_DOMAIN!
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!

interface ContactEmailData {
  name: string
  email: string
  subject: string
  message: string
  submittedAt: string
}

/** 发送给管理员的通知邮件 */
function buildAdminEmail(data: ContactEmailData) {
  return {
    from: `noreply@${DOMAIN}`,
    to: ADMIN_EMAIL,
    subject: `[TLDbi 反馈] ${data.subject} - 来自 ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">收到新的联系表单提交</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 100px;">姓名</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">邮箱</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">主题</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.subject}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">时间</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.submittedAt}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f9f9f9; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #555;">消息内容：</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${data.message}</p>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          此邮件由 TLDbi 网站自动发送，请勿直接回复。
        </p>
      </div>
    `,
  }
}

/** 发送给用户的确认邮件 */
function buildUserConfirmationEmail(data: ContactEmailData) {
  return {
    from: `TLDbi <noreply@${DOMAIN}>`,
    to: data.email,
    subject: `【TLDbi】感谢您的反馈 - 我们已收到您的消息`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">亲爱的 ${data.name}，</h2>
        <p style="line-height: 1.6; color: #555;">
          感谢您联系 TLDbi！<br/>
          我们已经收到您的反馈，将在 24-48 小时内给您回复。
        </p>
        <div style="margin-top: 20px; padding: 16px; background: #f0f7ff; border-radius: 8px;">
          <h3 style="margin-top: 0; color: #333;">您的提交内容：</h3>
          <p style="margin-bottom: 8px;"><strong>主题：</strong> ${data.subject}</p>
          <p style="margin-bottom: 0;"><strong>时间：</strong> ${data.submittedAt}</p>
        </div>
        <p style="margin-top: 24px; line-height: 1.6; color: #555;">
          如需紧急帮助，您可以回复此邮件或直接发送邮件至 ${ADMIN_EMAIL}。
        </p>
        <p style="margin-top: 24px; color: #888; font-size: 14px;">
          — TLDbi 团队<br/>
          <a href="https://tldbi.com" style="color: #3b82f6;">https://tldbi.com</a>
        </p>
      </div>
    `,
  }
}

export async function sendContactEmails(data: ContactEmailData) {
  const [adminResult, userResult] = await Promise.allSettled([
    resend.emails.send(buildAdminEmail(data)),
    resend.emails.send(buildUserConfirmationEmail(data)),
  ])

  const adminOk = adminResult.status === "fulfilled" && !adminResult.value.error
  const userOk = userResult.status === "fulfilled" && !userResult.value.error

  if (!adminOk) {
    console.error("[email] Failed to send admin notification:", adminResult)
  }
  if (!userOk) {
    console.error("[email] Failed to send user confirmation:", userResult)
  }

  /** 提取 Resend 返回的具体错误信息，便于排查（域名未验证 / 测试限制等） */
  function extractError(r: PromiseSettledResult<{ error: unknown }>): string | null {
    if (r.status !== "fulfilled") return "网络异常"
    const err = r.value.error as { message?: string } | null
    return err?.message ?? null
  }

  return { adminOk, userOk, adminError: adminOk ? null : extractError(adminResult), userError: userOk ? null : extractError(userResult) }
}
