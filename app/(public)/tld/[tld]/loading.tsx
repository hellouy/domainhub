export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="页面加载中"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:gap-10 md:px-6 md:py-12"
    >
      <div className="h-3 w-32 bg-secondary motion-safe:animate-pulse" />
      <div className="flex flex-col gap-2 md:gap-3">
        <div className="h-3 w-16 bg-secondary motion-safe:animate-pulse" />
        <div className="h-10 w-28 bg-secondary motion-safe:animate-pulse md:h-12" />
        <div className="h-4 w-full max-w-md bg-secondary motion-safe:animate-pulse" />
      </div>
      <div className="flex items-end gap-6 border-b border-border pb-6 md:gap-12">
        <div className="h-12 w-28 bg-secondary motion-safe:animate-pulse" />
        <div className="h-10 w-20 bg-secondary motion-safe:animate-pulse" />
        <div className="h-10 w-20 bg-secondary motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col divide-y divide-border border border-border">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-4 w-28 bg-secondary motion-safe:animate-pulse" />
              <div className="h-3 w-44 bg-secondary motion-safe:animate-pulse" />
            </div>
            <div className="h-5 w-16 bg-secondary motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
