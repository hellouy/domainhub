/** 公共页面导航时的即时加载反馈：点击链接立即出现骨架屏 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="页面加载中" className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
      <div className="flex flex-col gap-6">
        <div className="h-3 w-40 animate-pulse bg-secondary" />
        <div className="h-10 w-56 animate-pulse bg-secondary" />
        <div className="h-4 w-full max-w-xl animate-pulse bg-secondary" />
        <div className="grid grid-cols-3 gap-px border border-border bg-border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 bg-card p-3 md:p-6">
              <div className="h-3 w-16 animate-pulse bg-secondary" />
              <div className="h-6 w-20 animate-pulse bg-secondary" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-px border border-border bg-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
