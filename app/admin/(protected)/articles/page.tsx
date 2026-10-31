import Link from "next/link"
import { getAllArticles } from "@/lib/articles"
import { FileText, CheckCircle2, FileEdit, Sparkles } from "lucide-react"
import { PageHeader, StatCard, EmptyState } from "@/components/admin/ui"
import { GenerateArticleDialog } from "@/components/admin/generate-article-dialog"
import { ArticleEditDialog } from "@/components/admin/article-edit-dialog"
import { ArticlePublishToggle, DeleteArticleButton } from "@/components/admin/article-actions"
import { formatDateTime } from "@/lib/format"

export const metadata = { title: "文章管理" }

export default async function AdminArticlesPage() {
  const articles = await getAllArticles()
  const published = articles.filter((a) => a.isPublished).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="文章管理"
        description="用 AI 生成原创推广文章，编辑校对后发布，用于搜索引擎收录与 AI 引用。"
        actions={<GenerateArticleDialog />}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={FileText} label="文章总数" value={articles.length} />
        <StatCard icon={CheckCircle2} label="已发布" value={published} tone="positive" />
        <StatCard icon={FileEdit} label="草稿" value={articles.length - published} />
      </div>

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8">
          <EmptyState
            icon={Sparkles}
            title="还没有文章"
            hint="点击右上方「AI 生成文章」，输入主题即可生成第一篇原创草稿。"
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">语言</th>
                <th className="px-4 py-3">模型</th>
                <th className="px-4 py-3">权重</th>
                <th className="px-4 py-3">发布时间</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {articles.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{a.id}</td>
                  <td className="max-w-64 px-4 py-3">
                    {a.isPublished ? (
                      <Link href={`/articles/${a.slug}`} target="_blank" className="hover:text-primary">
                        {a.title}
                      </Link>
                    ) : (
                      <span>{a.title}</span>
                    )}
                    <p className="truncate font-mono text-xs text-muted-foreground">/{a.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase">{a.locale}</td>
                  <td className="max-w-32 truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                    {a.model ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{a.weight}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.publishedAt ? formatDateTime(a.publishedAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ArticlePublishToggle id={a.id} isPublished={a.isPublished} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <ArticleEditDialog article={a} />
                      <DeleteArticleButton id={a.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
