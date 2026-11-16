'use client'

/**
 * Detects when the Cloudflare Worker stops serving (for example after the
 * daily request quota runs out, when Cloudflare answers with an error page
 * that has no CORS headers). Failures only trigger a cheap probe; the notice is
 * shown only when the probe itself fails while the browser is online.
 */

export const WORKER_BASE = (process.env.NEXT_PUBLIC_VIDEO_PROXY_URL || 'https://dinhthong-video-proxy.tdt4903.workers.dev').replace(/\/+$/, '')
export const WORKER_STATUS_EVENT = 'dinhthong-worker-status'
export type WorkerStatus = 'ok' | 'overloaded'

const PROBE_INTERVAL_MS = 15_000
const PROBE_TIMEOUT_MS = 10_000

let status: WorkerStatus = 'ok'
let lastProbeAt = 0
let probing: Promise<boolean> | null = null

export function getWorkerStatus(): WorkerStatus {
  return status
}

function setStatus(next: WorkerStatus) {
  if (status === next) return
  status = next
  window.dispatchEvent(new CustomEvent<WorkerStatus>(WORKER_STATUS_EVENT, { detail: next }))
}

/** Loads a tiny Worker asset. Any non-image answer (error page, 429) fails. */
export function probeWorker(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(true)
  if (probing) return probing
  lastProbeAt = Date.now()
  probing = new Promise<boolean>(resolve => {
    const image = new window.Image()
    const timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS)
    function finish(ok: boolean) {
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(ok)
    }
    image.onload = () => finish(image.naturalWidth > 0)
    image.onerror = () => finish(false)
    image.src = `${WORKER_BASE}/assets/logo-web-v1.png?health=${Date.now()}`
  }).then(ok => {
    // Offline browsers fail every request; that is not a server overload.
    if (ok) setStatus('ok')
    else if (navigator.onLine !== false) setStatus('overloaded')
    return ok
  }).finally(() => { probing = null })
  return probing
}

/** Call after a Worker request failed. Probes at most once per interval. */
export function reportWorkerFailure() {
  if (typeof window === 'undefined') return
  if (Date.now() - lastProbeAt < PROBE_INTERVAL_MS) return
  void probeWorker()
}

export function isWorkerUrl(value: string): boolean {
  return Boolean(value) && value.startsWith(`${WORKER_BASE}/`)
}
