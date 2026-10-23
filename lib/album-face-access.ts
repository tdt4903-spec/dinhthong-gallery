'use client'

import { useCallback, useEffect, useState } from 'react'

const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
const ACCESS_CHANGED_EVENT = 'album-face-access-changed'

export type AlbumFaceAccess = { albumId: string; enabled: boolean }

async function requestAccess(albumId: string, options: { signal?: AbortSignal; token?: string; enabled?: boolean } = {}): Promise<AlbumFaceAccess> {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(albumId)) throw new Error('Mã album không hợp lệ.')
  const url = new URL(`${WORKER_BASE}/album-face-access`)
  url.searchParams.set('id', albumId)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  options.signal?.addEventListener('abort', cancel, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timeout = setTimeout(cancel, 10000)
  try {
    const write = typeof options.enabled === 'boolean'
    const response = await fetch(url, {
      method: write ? 'POST' : 'GET',
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: write ? { Authorization: `Bearer ${options.token || ''}`, 'Content-Type': 'application/json' } : undefined,
      body: write ? JSON.stringify({ enabled: options.enabled }) : undefined,
    })
    const data = await response.json()
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Không đọc được quyền lọc khuôn mặt.')
    if (data?.albumId !== albumId || typeof data?.enabled !== 'boolean') throw new Error('Quyền lọc khuôn mặt không hợp lệ.')
    return { albumId, enabled: data.enabled }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', cancel)
  }
}

/** This setting grants access only. It never loads face models or scans photos. */
export async function saveAlbumFaceAccess(albumId: string, enabled: boolean, token: string): Promise<AlbumFaceAccess> {
  if (!token) throw new Error('Vui lòng đăng nhập admin để thay đổi quyền lọc khuôn mặt.')
  const result = await requestAccess(albumId, { enabled, token })
  window.dispatchEvent(new CustomEvent<AlbumFaceAccess>(ACCESS_CHANGED_EVENT, { detail: result }))
  return result
}

export function useAlbumFaceAccess(albumId: string, observeChanges = true) {
  const [state, setState] = useState<{ albumId: string; value: AlbumFaceAccess | null; error: string }>({ albumId: '', value: null, error: '' })
  const [refreshVersion, setRefreshVersion] = useState(0)
  const refresh = useCallback(() => setRefreshVersion(version => version + 1), [])
  useEffect(() => {
    if (!albumId) return
    const controller = new AbortController()
    let active = true
    let requestVersion = 0
    const load = async () => {
      const version = ++requestVersion
      try {
        const value = await requestAccess(albumId, { signal: controller.signal })
        if (active && version === requestVersion) setState(previous => previous.value?.albumId === value.albumId && previous.value.enabled === value.enabled && !previous.error ? previous : { albumId, value, error: '' })
      } catch (error) {
        if (active && version === requestVersion && !controller.signal.aborted) setState({ albumId, value: null, error: error instanceof Error ? error.message : 'Không đọc được quyền lọc khuôn mặt.' })
      }
    }
    void load()
    const changed = (event: Event) => {
      const value = (event as CustomEvent<AlbumFaceAccess>).detail
      if (value?.albumId === albumId) { requestVersion++; setState({ albumId, value, error: '' }) }
    }
    const visible = () => { if (document.visibilityState === 'visible') void load() }
    const poll = observeChanges ? setInterval(visible, 30000) : undefined
    window.addEventListener(ACCESS_CHANGED_EVENT, changed)
    if (observeChanges) document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      controller.abort()
      clearInterval(poll)
      window.removeEventListener(ACCESS_CHANGED_EVENT, changed)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [albumId, observeChanges, refreshVersion])
  const value = state.albumId === albumId ? state.value : null
  return { enabled: value?.enabled === true, ready: Boolean(value), error: state.albumId === albumId ? state.error : '', refresh }
}
