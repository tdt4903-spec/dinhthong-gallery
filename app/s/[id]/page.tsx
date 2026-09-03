import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import GalleryClient from '@/app/gallery/GalleryClient'

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
  let coverUrl = ''

  if (supabaseUrl && secretKey && sharedId) {
    try {
      const admin = createClient(supabaseUrl, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      // 1. Tìm thông tin trong albums
      const { data: albums } = await admin.from('albums').select('id, title, cover_url, drive_url')
      let matched = (albums || []).find((a: any) => 
        String(a.id) === sharedId || 
        toNumericCode(String(a.id)) === sharedId || 
        extractDriveId(a.drive_url) === sharedId
      )

      if (matched) {
        title = matched.title || title
        coverUrl = matched.cover_url || ''
      }

      // 2. Nếu là thư mục con, tìm trong known_drive_folders & custom_covers
      if (!matched) {
        const { data: knownRows } = await admin.from('known_drive_folders').select('id, name')
        const matchedFolder = (knownRows || []).find((f: any) => 
          String(f.id) === sharedId || toNumericCode(String(f.id)) === sharedId
        )

        if (matchedFolder) {
          title = matchedFolder.name || title
          const targetFolderId = String(matchedFolder.id)
          const { data: customCover } = await admin
            .from('custom_covers')
            .select('cover_url')
            .eq('id', targetFolderId)
            .single()

          if (customCover?.cover_url) {
            coverUrl = customCover.cover_url
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy metadata thumbnail:', e)
    }
  }

  // Chuẩn hóa định dạng ảnh để Zalo/Facebook/Messenger đọc được
  let ogImageUrl = '/banner.jpg'
  if (coverUrl) {
    const driveId = extractDriveId(coverUrl)
    if (driveId) {
      // Dùng link thumbnail khổ lớn công khai chuẩn của Google CDN
      ogImageUrl = `https://lh3.googleusercontent.com/d/${driveId}=w1200-h630-p-k-no`
    } else {
      ogImageUrl = coverUrl
    }
  }

  return {
    title: `${title} - DinhThong Gallery`,
    description: `Xem và chọn ảnh chất lượng cao trong album ${title}`,
    openGraph: {
      title: `${title} - DinhThong Gallery`,
      description: `Xem và chọn ảnh chất lượng cao trong album ${title}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
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