'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { getDriveThumbnailUrl } from '@/lib/drive-thumbnail'

type Props = { src: string; alt: string; className?: string }

export default function ProductPreviewImage({ src, alt, className }: Props) {
  const source = getDriveThumbnailUrl(src)
  const [failedSource, setFailedSource] = useState('')
  if (!source || failedSource === source) {
    return (
      <div role="img" aria-label={`Chưa tải được ảnh xem trước: ${alt}`} className="flex h-full w-full items-center justify-center bg-black/5 text-gray-400">
        <ImageIcon aria-hidden="true" className="h-6 w-6" />
      </div>
    )
  }
  return <img src={source} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={className} onError={() => setFailedSource(source)} />
}
