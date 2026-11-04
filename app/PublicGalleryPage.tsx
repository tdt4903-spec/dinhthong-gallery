'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Camera, ImageIcon, Loader2, Moon, RefreshCw, Search, Sun, X } from 'lucide-react'
import { getCustomerProductsSupabase, type CustomerAlbum, type CustomerCategory } from '@/lib/customer-products'
import { useGalleryTheme } from '@/lib/use-gallery-theme'
import ApprovedAdminBadge from '@/components/ui/ApprovedAdminBadge'
import { adminPortraitUrl, SITE_BANNER_URL } from '@/lib/site-assets'
import PublicCategoryCards from '@/components/PublicCategoryCards'
import ProductPreviewImage from '@/components/ui/ProductPreviewImage'
import styles from './public-home.module.css'

type PublicCategory = Pick<CustomerCategory, 'id' | 'name' | 'slug'>

export default function PublicGalleryPage({ category }: { category?: PublicCategory }) {
  const supabase = useMemo(() => getCustomerProductsSupabase(), [])
  const { isDarkMode, toggleTheme } = useGalleryTheme()
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [albums, setAlbums] = useState<CustomerAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [portraits, setPortraits] = useState<{ display_name: string; photo_key: string }[]>([])
  useEffect(() => {
    if (category) return
    let active = true
    void supabase.rpc('get_portfolio_admin_portraits').then(({ data }) => {
      if (active && Array.isArray(data)) setPortraits(data)
    })
    return () => { active = false }
  }, [supabase, category])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      let albumQuery = supabase.from('customer_product_albums').select('*').eq('is_public', true)
        .order('position', { ascending: true }).order('created_at', { ascending: false })
      if (category) albumQuery = albumQuery.eq('category_id', category.id)
      const [categoryResult, albumResult] = await Promise.all([
        category ? Promise.resolve({ data: [category], error: null }) : supabase.from('customer_product_categories')
          .select('id,name,slug').eq('visible', true).order('position', { ascending: true }),
        albumQuery,
      ])
      if (categoryResult.error || albumResult.error) {
        console.error(categoryResult.error || albumResult.error)
        setLoadError(true)
        return
      }
      const visibleCategories = (categoryResult.data || []) as PublicCategory[]
      const visibleCategoryIds = new Set(visibleCategories.map(item => item.id))
      const publicAlbums = (albumResult.data || []) as CustomerAlbum[]
      setCategories(visibleCategories)
      // Home only showcases albums from visible collections, preserving category visibility.
      setAlbums(category ? publicAlbums : publicAlbums.filter(album => album.category_id !== null && visibleCategoryIds.has(album.category_id)))
    } catch (error) {
      console.error(error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase, category])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    document.title = category ? `${category.name} — Dinh Thong Gallery` : 'Dinh Thong Gallery — Khoảnh khắc còn mãi'
  }, [category])

  const matchingAlbums = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('vi')
    return albums.filter(album => (selectedCategory === 'all' || album.category_id === selectedCategory)
      && (!search || `${album.title} ${album.description || ''}`.toLocaleLowerCase('vi').includes(search)))
  }, [albums, query, selectedCategory])
  const visibleAlbums = category || query || selectedCategory !== 'all' ? matchingAlbums : matchingAlbums.slice(0, 6)

  return (
    <main className={styles.page} data-site-theme={isDarkMode ? 'dark' : 'light'}>
      <a href="#portfolio" className={styles.skipLink}>Đến nội dung bộ ảnh</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Dinh Thong Gallery — Trang chủ">
            <span className={styles.brandIcon}><Camera size={21} strokeWidth={1.5} aria-hidden="true" /></span>
            <span>Dinh Thong Gallery<span className={styles.brandSubtitle}>PHOTOGRAPHY & STORIES</span></span>
          </Link>
          <nav className={styles.nav} aria-label="Điều hướng portfolio">
            <Link href="/#portfolio" className={styles.active}>Portfolio</Link>
            <Link href="/#about">Về Dinh Thong Photos</Link>
          </nav>
          <div className={styles.headerActions}>
            <button type="button" onClick={toggleTheme} className={styles.iconButton} aria-label={isDarkMode ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'} title="Đổi giao diện sáng / tối">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link href="/booking" prefetch={false} className={styles.bookingButton}>Đặt lịch chụp <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      {!category && <>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> Dinh Thong Gallery</p>
            <h1 id="hero-title" className={styles.heroTitle}>Lưu giữ<br />những điều<br /><em>thật đẹp.</em></h1>
            <p className={styles.heroDescription}>Một ánh nhìn, một nụ cười, một khoảnh khắc.<br />Những câu chuyện được kể bằng hình ảnh,<br className={styles.desktopBreak} /> qua góc nhìn của Dinh Thong Gallery.</p>
            <a href="#portfolio" className={styles.primaryButton}>Khám phá portfolio <ArrowUpRight size={18} aria-hidden="true" /></a>
            <div className={styles.heroFootnote}><span className={styles.footnoteLine} /><p>Những khoảnh khắc trôi qua.<br /><strong>Cảm xúc ở lại.</strong></p></div>
          </div>
          <div className={styles.heroVisual}>
            <img src={SITE_BANNER_URL} alt="Khoảnh khắc qua góc nhìn của Dinh Thong Gallery" className={styles.heroImage} fetchPriority="high" />
            <div className={styles.heroImageCaption}><span>THE ART OF REMEMBERING</span><Camera size={19} strokeWidth={1.5} aria-hidden="true" /></div>
            <div className={styles.photoNote}><span>Moments,</span><em>for a lifetime.</em></div>
          </div>
          <a href="#portfolio" className={styles.scrollLink}><ArrowDown size={16} aria-hidden="true" /> CUỘN ĐỂ KHÁM PHÁ</a>
        </section>
        <div className={styles.statementBar}><span>REAL MOMENTS.</span><span className={styles.statementStar} aria-hidden="true">✳</span><span>HONEST STORIES.</span><span className={styles.statementStar} aria-hidden="true">✳</span><span>TIMELESS MEMORIES.</span></div>
      </>}

      <section id="portfolio" className={styles.portfolio} aria-labelledby="portfolio-title">
        {category && <Link href="/#portfolio" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" /> Tất cả bộ sưu tập</Link>}
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>{category ? 'BỘ SƯU TẬP' : 'QUA TỪNG KHUNG HÌNH'}</p><h2 id="portfolio-title" className={styles.sectionTitle}>{category ? category.name : <>Mỗi bộ ảnh,<br /><em>một câu chuyện.</em></>}</h2></div>
          <p className={styles.sectionDescription}>{category ? 'Những khoảnh khắc được lưu giữ trong bộ sưu tập này. Chọn một album để xem trọn câu chuyện.' : 'Có những cảm xúc không cần nói thành lời. Hãy cùng khám phá những câu chuyện được Dinh Thong Gallery kể qua từng bộ ảnh.'}</p>
        </div>

        {loading ? <div className={styles.loadingState} role="status"><Loader2 size={26} className={styles.spinner} aria-hidden="true" /><span>Đang mở những câu chuyện…</span></div>
          : loadError ? <div className={styles.emptyState} role="alert"><ImageIcon size={28} aria-hidden="true" /><h3>Chưa thể tải bộ ảnh</h3><p>Vui lòng thử lại để xem portfolio.</p><button type="button" className={styles.secondaryButton} onClick={() => void loadData()}><RefreshCw size={16} /> Tải lại</button></div>
          : <>
            {!category && categories.length > 0 && <PublicCategoryCards categories={categories} albums={albums} />}
            {(albums.length > 0 || category) && <div className={styles.albumSection}>
              <div className={styles.albumToolbar}>
                <div><p className={styles.eyebrow}>{category ? 'KHÁM PHÁ ALBUM' : 'PORTFOLIO'}</p><h3 className={styles.albumHeading}>{category ? 'Tất cả bộ ảnh' : 'Những bộ ảnh gần đây'}</h3></div>
                <label className={styles.search}><Search size={17} aria-hidden="true" /><span className="sr-only">Tìm bộ ảnh</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm một câu chuyện…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}</label>
              </div>
              {!category && categories.length > 0 && <div className={styles.filters} role="group" aria-label="Lọc album theo bộ sưu tập">{categories.map(item => <button key={item.id} type="button" aria-pressed={selectedCategory === item.id} onClick={() => setSelectedCategory(selectedCategory === item.id ? 'all' : item.id)}>{item.name}</button>)}</div>}
              <p className={styles.resultCount} aria-live="polite">{query || selectedCategory !== 'all' ? `${matchingAlbums.length} bộ ảnh phù hợp` : `${albums.length} bộ ảnh`}</p>
              {visibleAlbums.length > 0 ? <div className={styles.albumGrid}>{visibleAlbums.map((album, index) => <Link key={album.id} href={`/${encodeURIComponent(album.slug)}`} prefetch={false} className={styles.albumCard}>
                <div className={styles.albumImage}>{album.cover_url ? <ProductPreviewImage src={album.cover_url} alt={album.title} className={styles.coverImage} /> : <ImageIcon size={32} aria-hidden="true" />}{album.is_featured && <span className={styles.featured}>Nổi bật</span>}<span className={styles.imageCounter}>{String(index + 1).padStart(2, '0')}</span></div>
                <div className={styles.albumMeta}><div><p className={styles.albumCategory}>{categories.find(item => item.id === album.category_id)?.name || 'Dinh Thong Gallery'}</p><h4>{album.title}</h4>{album.shoot_date && <p className={styles.albumDate}>{new Date(album.shoot_date).toLocaleDateString('vi-VN')}</p>}</div><span className={styles.cardArrow}><ArrowUpRight size={19} aria-hidden="true" /></span></div>
              </Link>)}</div> : <div className={styles.emptyState}><ImageIcon size={28} aria-hidden="true" /><h3>{query || selectedCategory !== 'all' ? 'Chưa tìm thấy bộ ảnh' : 'Câu chuyện mới đang được chuẩn bị'}</h3><p>{query || selectedCategory !== 'all' ? 'Thử một từ khóa hoặc bộ sưu tập khác.' : 'Những khoảnh khắc mới sẽ sớm xuất hiện tại đây.'}</p>{(query || selectedCategory !== 'all') && <button type="button" className={styles.secondaryButton} onClick={() => { setQuery(''); setSelectedCategory('all') }}>Xóa bộ lọc <ArrowRight size={16} /></button>}</div>}
            </div>}
            {!category && !albums.length && !categories.length && <div className={styles.emptyState}><Camera size={30} aria-hidden="true" /><h3>Câu chuyện mới đang được chuẩn bị</h3><p>Những bộ ảnh mới sẽ sớm được giới thiệu tại đây.</p></div>}
          </>}
      </section>

      {!category && <section id="about" className={styles.about} aria-labelledby="about-title"><div className={styles.aboutLabel}>{portraits.length > 0 && <ul className={styles.portraits}>{portraits.map(profile => <li key={profile.photo_key}>
        <img src={adminPortraitUrl(profile.photo_key)} loading="lazy" alt="" />
        <span>{profile.display_name} <ApprovedAdminBadge /></span>
      </li>)}</ul>}{!portraits.length && <Camera size={26} strokeWidth={1.3} aria-hidden="true" />}<p className={styles.eyebrow}>Về Dinh Thong Photos</p></div><div><h2 id="about-title">Đẹp nhất là khi<br /><em>bạn được là chính mình.</em></h2><p>Dinh Thong Gallery lưu giữ những câu chuyện thật và những cảm xúc tự nhiên. Từ ý tưởng đầu tiên đến khung hình cuối cùng, mỗi bộ ảnh là một cách để nhớ về những điều có ý nghĩa với bạn.</p></div></section>}

      <footer className={styles.footer}><Link href="/" className={styles.footerBrand}>Dinh Thong Gallery</Link><p>© {new Date().getFullYear()} Dinh Thong Gallery.<br className={styles.mobileBreak} /> Khoảnh khắc lưu giữ cảm xúc.</p></footer>
    </main>
  )
}
