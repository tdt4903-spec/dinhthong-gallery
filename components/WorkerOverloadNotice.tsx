'use client'

import { useEffect, useState } from 'react'
import {
  WORKER_STATUS_EVENT,
  getWorkerStatus,
  isWorkerUrl,
  probeWorker,
  reportWorkerFailure,
  type WorkerStatus,
} from '@/lib/worker-health'

const RECHECK_MS = 30_000

/** Site-wide notice shown while the Cloudflare media server is unavailable. */
export default function WorkerOverloadNotice() {
  const [status, setStatus] = useState<WorkerStatus>(() => getWorkerStatus())

  useEffect(() => {
    const changed = (event: Event) => setStatus((event as CustomEvent<WorkerStatus>).detail)
    // Image/video load errors do not bubble; capture them for Worker URLs.
    const mediaError = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLImageElement || target instanceof HTMLVideoElement || target instanceof HTMLSourceElement)) return
      const source = (target as HTMLImageElement).currentSrc || (target as HTMLImageElement).src || ''
      if (isWorkerUrl(source)) reportWorkerFailure()
    }
    window.addEventListener(WORKER_STATUS_EVENT, changed)
    window.addEventListener('error', mediaError, true)
    return () => {
      window.removeEventListener(WORKER_STATUS_EVENT, changed)
      window.removeEventListener('error', mediaError, true)
    }
  }, [])

  // While the notice is visible, check again periodically and hide it on recovery.
  useEffect(() => {
    if (status !== 'overloaded') return
    const timer = setInterval(() => { void probeWorker() }, RECHECK_MS)
    return () => clearInterval(timer)
  }, [status])

  if (status !== 'overloaded') return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[1000] flex justify-center px-4"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      <div className="flex max-w-xl items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-xl">
        <span aria-hidden="true" className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
        <div>
          <p className="font-bold">Hệ thống hiện đang quá tải, vui lòng chờ.</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            Ảnh và lượt tải có thể chưa hiển thị. Trang sẽ tự kiểm tra lại, bạn vui lòng thử lại sau ít phút.
          </p>
        </div>
      </div>
    </div>
  )
}
