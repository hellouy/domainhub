"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ContactPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "提交失败，请稍后重试")
        return
      }
      setSuccess(true)
    } catch {
      setError("网络错误，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
          <svg className="size-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">提交成功</h1>
        <p className="text-muted-foreground">
          我们已收到您的反馈，会在 24-48 小时内通过邮件回复您。
        </p>
        <button
          onClick={() => router.push("/")}
          className="mx-auto mt-4 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 md:px-6 md:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">联系我们</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">联系 & 反馈</h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          有任何问题、建议或合作意向？请填写下方表单，我们会在 24-48 小时内回复您。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
              姓名 <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="您的姓名"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              邮箱 <span className="text-destructive">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="your@email.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="subject" className="text-xs font-medium text-muted-foreground">
            主题 <span className="text-destructive">*</span>
          </label>
          <select
            id="subject"
            name="subject"
            required
            value={form.subject}
            onChange={handleChange}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="" disabled>选择咨询类型</option>
            <option value="价格问题">价格问题</option>
            <option value="注册商反馈">注册商反馈</option>
            <option value="合作洽谈">合作洽谈</option>
            <option value="Bug 反馈">Bug 反馈</option>
            <option value="功能建议">功能建议</option>
            <option value="其他">其他</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="message" className="text-xs font-medium text-muted-foreground">
            消息内容 <span className="text-destructive">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={6}
            value={form.message}
            onChange={handleChange}
            placeholder="请详细描述您的问题或建议..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "提交中..." : "提交反馈"}
        </button>
      </form>
    </div>
  )
}
