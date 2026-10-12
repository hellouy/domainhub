"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const FALLBACK_HIDE_MS = 8000

/** Slim top progress bar: non-blocking, no modal, only appears for in-site navigations. */
export function NavigationFeedback() {
  const pathname = usePathname()
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return

      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return

      if (timer.current) clearTimeout(timer.current)
      active.current = true
      setState("loading")
      timer.current = setTimeout(() => {
        active.current = false
        setState("idle")
      }, FALLBACK_HIDE_MS)
    }

    document.addEventListener("click", handleDocumentClick, true)
    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (!active.current) return
    active.current = false
    if (timer.current) clearTimeout(timer.current)
    setState("done")
    timer.current = setTimeout(() => setState("idle"), 260)
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className="navigation-progress"
      data-state={state}
    >
      <span className="navigation-progress__bar" />
    </div>
  )
}
