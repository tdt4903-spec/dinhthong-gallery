'use client'

import { useCallback, useEffect, useState } from 'react'

const OVERRIDE_KEY = 'dinhthong_gallery_theme_override_v1'

type ThemeName = 'light' | 'dark'

type ThemeOverride = {
  theme: ThemeName
  expiresAt: number
}

function getAutoDarkMode() {
  const hour = new Date().getHours()

  // 06:00 -> 17:59: sáng
  // 18:00 -> 05:59: tối
  return !(hour >= 6 && hour < 18)
}

function getNextThemeBoundary() {
  const now = new Date()
  const next = new Date(now)

  const hour = now.getHours()

  if (hour < 6) {
    next.setHours(6, 0, 0, 0)
  } else if (hour < 18) {
    next.setHours(18, 0, 0, 0)
  } else {
    next.setDate(next.getDate() + 1)
    next.setHours(6, 0, 0, 0)
  }

  return next.getTime()
}

function readTheme() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)

    if (raw) {
      const parsed = JSON.parse(raw) as ThemeOverride

      if (
        parsed &&
        (parsed.theme === 'light' || parsed.theme === 'dark') &&
        parsed.expiresAt > Date.now()
      ) {
        return parsed.theme === 'dark'
      }

      localStorage.removeItem(OVERRIDE_KEY)
    }
  } catch {
    localStorage.removeItem(OVERRIDE_KEY)
  }

  return getAutoDarkMode()
}

export function useGalleryTheme() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  const refreshTheme = useCallback(() => {
    setIsDarkMode(readTheme())
  }, [])

  useEffect(() => {
    setMounted(true)
    refreshTheme()

    const timer = window.setInterval(refreshTheme, 30_000)

    const handleStorage = () => refreshTheme()
    const handleFocus = () => refreshTheme()

    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshTheme])

  const toggleTheme = useCallback(() => {
    const currentDark = readTheme()
    const nextDark = !currentDark

    const payload: ThemeOverride = {
      theme: nextDark ? 'dark' : 'light',
      expiresAt: getNextThemeBoundary(),
    }

    localStorage.setItem(
      OVERRIDE_KEY,
      JSON.stringify(payload)
    )

    setIsDarkMode(nextDark)
  }, [])

  const resetAutoTheme = useCallback(() => {
    localStorage.removeItem(OVERRIDE_KEY)
    setIsDarkMode(getAutoDarkMode())
  }, [])

  return {
    isDarkMode,
    mounted,
    toggleTheme,
    resetAutoTheme,
  }
}
