import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'
import { SITE_SHARE_IMAGE_URL } from '@/lib/site-assets'

interface Props {
  params: Promise<{ id: string }> | { id: string }
}

const getSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const extractDriveId = (url: string) => {
  if (!url) return ''
  const clean = url.trim()
  const matchFolder = clean.match(/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolder && matchFolder[1]) return matchFolder[1]
  const matchFile = clean.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchFile && matchFile[1]) return matchFile[1]
  return clean.replace(/[^a-zA-Z0-9_-]/g, '')
}

const toNumericCode = (str: string) => {
  if (!str) return ''
  if (/^\d{6}$/.test(str)) return str
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return String(Math.abs(hash) % 900000 + 100000)
}

// HÀM TẠO THUMBNAIL OPEN GRAPH ĐỂ GỬI LINK HIỆN ẢNH BÌA
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params)
  const sharedId = String(resolvedParams.id || '').trim()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = getSecretKey()

  let title = 'DinhThong Gallery'

  if (supabaseUrl && secretKey && sharedId) {
    try {
      const admin = createClient(supabaseUrl, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      // 1. Tìm thông tin trong albums
      const { data: albums } = await admin.from('albums').select('id, title, drive_url')
      const matched = (albums || []).find((a: any) =>
        String(a.id) === sharedId || 
        toNumericCode(String(a.id)) === sharedId || 
        extractDriveId(a.drive_url) === sharedId
      )

      if (matched) {
        title = matched.title || title
      }

      // 2. Nếu là thư mục con, lấy tên từ known_drive_folders.
      if (!matched) {
        const { data: knownRows } = await admin.from('known_drive_folders').select('id, name')
        const matchedFolder = (knownRows || []).find((f: any) => 
          String(f.id) === sharedId || toNumericCode(String(f.id)) === sharedId
        )

        if (matchedFolder) {
          title = matchedFolder.name || title
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy metadata thumbnail:', e)
    }
  }

  const ogImageUrl = SITE_SHARE_IMAGE_URL

  return {
    title: `${title} - DinhThong Gallery`,
    description: `Xem và chọn ảnh chất lượng cao trong album ${title}`,
    openGraph: {
      title: `${title} - DinhThong Gallery`,
      description: `Xem và chọn ảnh chất lượng cao trong album ${title}`,
      images: [
        {
          url: ogImageUrl,
          width: 512,
          height: 512,
          type: 'image/png',
          alt: title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - DinhThong Gallery`,
      description: `Xem và chọn ảnh chất lượng cao trong album ${title}`,
      images: [ogImageUrl],
    },
  }
}

export default async function SharedAlbumPage({ params }: Props) {
  return <GalleryClient />
}
