"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const FALLBACK_HIDE_MS = 8000

function internalLinkFrom(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>("a[href]")
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return null
  const destination = new URL(link.href, window.location.href)
  if (destination.origin !== window.location.origin) return null
  return { link, destination }
}

/** Slim top progress bar plus instant pressed state on the tapped link. */
export function NavigationFeedback() {
  const pathname = usePathname()
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "done">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)
  const pendingLink = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    function clearPending() {
      pendingLink.current?.removeAttribute("data-pending")
      pendingLink.current = null
    }

    // Warm the route as soon as the finger lands, ~100ms before click fires.
    function handlePointerDown(event: PointerEvent) {
      const hit = internalLinkFrom(event.target)
      if (!hit) return
      router.prefetch(hit.destination.pathname + hit.destination.search)
    }

    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const hit = internalLinkFrom(event.target)
      if (!hit) return
      const { link, destination } = hit
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return

      clearPending()
      link.setAttribute("data-pending", "true")
      pendingLink.current = link

      if (timer.current) clearTimeout(timer.current)
      active.current = true
      setState("loading")
      timer.current = setTimeout(() => {
        active.current = false
        clearPending()
        setState("idle")
      }, FALLBACK_HIDE_MS)
    }

    // iOS Safari only applies :active when a touchstart listener exists.
    const noop = () => {}
    document.addEventListener("touchstart", noop, { passive: true })
    document.addEventListener("pointerdown", handlePointerDown, { passive: true })
    document.addEventListener("click", handleDocumentClick, true)
    return () => {
      document.removeEventListener("touchstart", noop)
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("click", handleDocumentClick, true)
      if (timer.current) clearTimeout(timer.current)
      clearPending()
    }
  }, [router])

  useEffect(() => {
    if (!active.current) return
    active.current = false
    pendingLink.current?.removeAttribute("data-pending")
    pendingLink.current = null
    if (timer.current) clearTimeout(timer.current)
    setState("done")
    timer.current = setTimeout(() => setState("idle"), 260)
  }, [pathname])

  return (
    <div aria-hidden="true" className="navigation-progress" data-state={state}>
      <span className="navigation-progress__bar" />
    </div>
  )
}
