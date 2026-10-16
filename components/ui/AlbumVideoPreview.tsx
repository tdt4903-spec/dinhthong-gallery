'use client'

import { useState } from 'react'
import { getCloudflareMediaUrl } from '@/lib/cloudflare-download'

type Props = { id: string; name: string; nativeControls: boolean }

export default function AlbumVideoPreview({ id, name, nativeControls }: Props) {
  const [failed, setFailed] = useState(false)

  if (!nativeControls) {
    return (
      <div className="relative flex aspect-video w-full max-w-5xl items-center justify-center overflow-hidden rounded-2xl bg-black shadow-2xl">
        <iframe
          title={name}
          src={`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }

  const source = `${getCloudflareMediaUrl({ id, name, type: 'video' })}&inline=1`
  return (
    <div
      className="relative flex h-full min-h-0 w-full max-w-5xl items-center justify-center"
      onClick={event => event.stopPropagation()}
      onTouchStart={event => event.stopPropagation()}
      onTouchMove={event => event.stopPropagation()}
      onTouchEnd={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation() }}
    >
      {failed ? (
        <p role="alert" className="max-w-sm rounded-2xl bg-white/10 p-4 text-center text-sm leading-6 text-white">
          Không thể phát video này trên trình duyệt. Bạn có thể nhấn “Tải video” để lưu và mở bằng ứng dụng trên điện thoại.
        </p>
      ) : (
        <video
          aria-label={name}
          src={source}
          controls
          playsInline
          preload="metadata"
          className="block h-full max-h-full w-full max-w-full rounded-xl bg-black object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
