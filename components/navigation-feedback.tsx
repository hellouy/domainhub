"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const MINIMUM_VISIBLE_MS = 240
const FALLBACK_HIDE_MS = 2500

export function NavigationFeedback() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const [isSettling, setIsSettling] = useState(false)
  const [statusLabel, setStatusLabel] = useState("正在打开页面")
  const startedAt = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return

      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return

      if (hideTimer.current) clearTimeout(hideTimer.current)
      startedAt.current = Date.now()
      setStatusLabel(document.documentElement.lang.startsWith("en") ? "Opening page" : "正在打开页面")
      setIsSettling(false)
      setIsVisible(true)
      hideTimer.current = setTimeout(() => {
        setIsSettling(true)
        hideTimer.current = setTimeout(() => {
          setIsVisible(false)
          setIsSettling(false)
          startedAt.current = 0
        }, 180)
      }, FALLBACK_HIDE_MS)
    }

    document.addEventListener("click", handleDocumentClick, true)
    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!startedAt.current) return

    if (hideTimer.current) clearTimeout(hideTimer.current)
    const remainingVisibleMs = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - startedAt.current))
    hideTimer.current = setTimeout(() => {
      setIsSettling(true)
      hideTimer.current = setTimeout(() => {
        setIsVisible(false)
        setIsSettling(false)
        startedAt.current = 0
      }, 180)
    }, remainingVisibleMs)
  }, [pathname])

  return (
    <div
      className={`navigation-feedback${isVisible ? " is-visible" : ""}${isSettling ? " is-settling" : ""}`}
    >
      {isVisible && <span role="status" aria-live="polite" className="sr-only">{statusLabel}</span>}
      <span className="navigation-feedback__bar" />
    </div>
  )
}
