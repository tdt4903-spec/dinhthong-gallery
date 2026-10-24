'use client'

import { useEffect } from 'react'

type SavedProperty = { style: CSSStyleDeclaration; property: string; value: string; priority: string }
const locks = new Set<symbol>()
let savedProperties: SavedProperty[] = []

/** Dialogs can overlap or close in any order. Restore page scrolling only when
 * the final owner releases its lock, never from another dialog's hidden state. */
export function acquirePageScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {}
  const token = Symbol('page-scroll-lock')
  if (locks.size === 0) {
    const html = document.documentElement
    const body = document.body
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth)
    const paddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0
    savedProperties = [html.style, body.style].flatMap(style =>
      ['overflow-x', 'overflow-y', 'overscroll-behavior-x', 'overscroll-behavior-y'].map(property => ({
        style, property, value: style.getPropertyValue(property), priority: style.getPropertyPriority(property),
      })))
    savedProperties.push({ style: body.style, property: 'padding-right', value: body.style.getPropertyValue('padding-right'), priority: body.style.getPropertyPriority('padding-right') })
    for (const style of [html.style, body.style]) {
      style.setProperty('overflow-x', 'hidden')
      style.setProperty('overflow-y', 'hidden')
      style.setProperty('overscroll-behavior-x', 'none')
      style.setProperty('overscroll-behavior-y', 'none')
    }
    if (scrollbarWidth > 0) body.style.setProperty('padding-right', `${paddingRight + scrollbarWidth}px`)
  }
  locks.add(token)
  return () => {
    if (!locks.delete(token) || locks.size > 0) return
    for (const { style, property, value, priority } of savedProperties) {
      if (value) style.setProperty(property, value, priority)
      else style.removeProperty(property)
    }
    savedProperties = []
  }
}

export function usePageScrollLock(enabled: boolean) {
  useEffect(() => {
    if (enabled) return acquirePageScrollLock()
  }, [enabled])
}
