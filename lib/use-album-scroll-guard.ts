'use client'

import { useEffect } from 'react'

/** Older iOS/in-app browsers can ignore root overscroll-behavior. Cancel only
 * an outward single-finger drag when no ancestor can scroll in that direction.
 * Normal album scrolling, sliders, horizontal tabs and pinch zoom are retained. */
export function useAlbumScrollGuard() {
  useEffect(() => {
    const previousHtml = document.documentElement.style.overscrollBehaviorY
    const previousBody = document.body.style.overscrollBehaviorY
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'
    let lastX = 0, lastY = 0
    let tracking = false
    let scrollableAncestors: Element[] = []
    let scrolling: Element | null = null
    let bodyLocked = false
    const start = (event: TouchEvent) => {
      tracking = false
      scrollableAncestors = []
      if (event.touches.length !== 1) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input[type="range"], video, [data-allow-touch-gesture]')) return
      lastX = event.touches[0].clientX
      lastY = event.touches[0].clientY
      // Resolve styles once per gesture. Reading computed styles throughout a
      // document-wide, non-passive touchmove would slow ordinary album scrolling.
      for (let node = target; node && node !== document.documentElement; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) scrollableAncestors.push(node)
      }
      scrolling = document.scrollingElement
      bodyLocked = /^(hidden|clip)$/.test(getComputedStyle(document.body).overflowY) || /^(hidden|clip)$/.test(getComputedStyle(document.documentElement).overflowY)
      tracking = true
    }
    const move = (event: TouchEvent) => {
      if (event.touches.length !== 1) { tracking = false; return }
      if (!tracking || !event.cancelable) return
      const point = event.touches[0]
      const dx = point.clientX - lastX, dy = point.clientY - lastY
      lastX = point.clientX; lastY = point.clientY
      if (Math.abs(dy) < 1 || Math.abs(dx) > Math.abs(dy)) return
      // Bounds can change while thumbnails or modal content load, so only
      // ancestor membership is cached; current scroll bounds are read each move.
      for (const element of scrollableAncestors) {
        if (!element.isConnected || element.scrollHeight <= element.clientHeight + 1) continue
        if ((dy > 0 && element.scrollTop > 0) || (dy < 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1)) return
      }
      if (!bodyLocked && scrolling && ((dy > 0 && scrolling.scrollTop > 0) || (dy < 0 && scrolling.scrollTop + document.documentElement.clientHeight < scrolling.scrollHeight - 1))) return
      event.preventDefault()
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: false })
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.documentElement.style.overscrollBehaviorY = previousHtml
      document.body.style.overscrollBehaviorY = previousBody
    }
  }, [])
}
