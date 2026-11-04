'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, Eye, EyeOff, FolderOpen, Globe, ImageIcon, Loader2, Moon, Plus, RefreshCw, Search, Star, Sun, X } from 'lucide-react'
import ProductPreviewImage from '@/components/ui/ProductPreviewImage'
import { getPublicCategoryPath } from '@/lib/public-gallery-paths'
import { useGalleryTheme } from '@/lib/use-gallery-theme'
import { updateAlbumPresentation, updateCategoryVisibility } from './actions'
import type { PortfolioActionResult, PortfolioAlbum, PortfolioCategory } from './types'
import styles from './portfolio-dashboard.module.css'

type Props = { categories: PortfolioCategory[]; albums: PortfolioAlbum[]; loadError?: boolean; readOnly: boolean }
type View = 'all' | 'visible' | 'hidden' | 'featured'

export default function PortfolioDashboard({ categories, albums, readOnly, loadError = false }: Props) {
  const router = useRouter()
  const { isDarkMode, toggleTheme } = useGalleryTheme()
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [pending, startTransition] = useTransition()
  const [activeItem, setActiveItem] = useState('')
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null)
  const visibleCategoryIds = useMemo(() => new Set(categories.filter(item => item.visible).map(item => item.id)), [categories])
  const isVisible = (album: PortfolioAlbum) => album.is_public && album.category_id !== null && visibleCategoryIds.has(album.category_id)
  const visibleAlbums = albums.filter(isVisible)
  const featuredAlbums = visibleAlbums.filter(item => item.is_featured)
  const counts = { all: albums.length, visible: visibleAlbums.length, hidden: albums.length - visibleAlbums.length, featured: albums.filter(item => item.is_featured).length }
  const filteredAlbums = albums.filter(album => {
    if (categoryFilter !== 'all' && album.category_id !== categoryFilter) return false
    if (view === 'visible' && !isVisible(album)) return false
    if (view === 'hidden' && isVisible(album)) return false
    if (view === 'featured' && !album.is_featured) return false
    return `${album.title} ${categories.find(item => item.id === album.category_id)?.name || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
  })

  const save = (key: string, action: () => Promise<PortfolioActionResult>, message: string) => {
    setNotice(null)
    setActiveItem(key)
    startTransition(async () => {
      try {
        const result = await action()
        setNotice(result.ok ? { message, error: false } : { message: result.error, error: true })
      } catch {
        setNotice({ message: 'Chưa thể lưu thay đổi. Vui lòng thử lại hoặc đăng nhập lại.', error: true })
      } finally {
        setActiveItem('')
      }
    })
  }

  return (
    <main className={`site-page-surface studio-management-page ${styles.page}`} data-site-theme={isDarkMode ? 'dark' : 'light'}>
      <header className={styles.header}>
        <div><span className={styles.headerLabel}><Globe size={16} strokeWidth={1.6} aria-hidden="true" />Portfolio public</span><div className={styles.headerActions}><button type="button" onClick={() => { setNotice(null); startTransition(() => router.refresh()) }} disabled={pending} title="Làm mới dữ liệu" aria-label="Làm mới dữ liệu" className={styles.iconButton}><RefreshCw size={16} className={pending && !activeItem ? styles.spinner : ''} /></button><button type="button" onClick={toggleTheme} aria-label={isDarkMode ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'} className={styles.iconButton}>{isDarkMode ? <Sun size={17} /> : <Moon size={17} />}</button><Link href="/" target="_blank" rel="noopener noreferrer" className={styles.previewLink}>Xem portfolio <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div>
      </header>

      <div className={styles.content}>
        <section className={styles.intro} aria-labelledby="portfolio-management-title"><div><p className={styles.eyebrow}>KHÔNG GIAN TRƯNG BÀY</p><h1 id="portfolio-management-title">Những câu chuyện<br /><em>được chọn để chia sẻ.</em></h1><p>Quản lý bộ sưu tập và những bộ ảnh xuất hiện trên portfolio của studio.</p></div><Link href="/dashboardsp" prefetch={false} className={styles.primaryButton}><Plus size={16} aria-hidden="true" />Quản lý sản phẩm</Link></section>

        {readOnly && <p className={styles.visibilityNote}>Đang xem thử dữ liệu công khai. Đăng nhập bằng tài khoản quản trị để chỉnh sửa.</p>}
        {loadError ? <div className={styles.loadError} role="alert"><EyeOff size={25} aria-hidden="true" /><h2>Chưa thể tải dữ liệu portfolio</h2><p>Vui lòng tải lại để tiếp tục quản lý nội dung public.</p><button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className={styles.secondaryButton}><RefreshCw size={15} />Tải lại</button></div> : <>
          <section className={styles.stats} aria-label="Tổng quan portfolio">
            {[{ label: 'Bộ sưu tập', value: categories.length, note: `${categories.filter(item => item.visible).length} đang hiển thị`, icon: FolderOpen }, { label: 'Album trên portfolio', value: visibleAlbums.length, note: 'Trong bộ sưu tập đang hiển thị', icon: Eye }, { label: 'Album nổi bật', value: featuredAlbums.length, note: 'Được gắn nhãn trên portfolio', icon: Star }, { label: 'Album đang ẩn', value: counts.hidden, note: 'Bao gồm bộ sưu tập đang ẩn', icon: EyeOff }].map(({ label, value, note, icon: Icon }) => <div key={label} className={styles.stat}><div><span>{label}</span><Icon size={16} strokeWidth={1.5} aria-hidden="true" /></div><strong>{value}</strong><p>{note}</p></div>)}
          </section>

          {notice && <div className={notice.error ? styles.noticeError : styles.noticeSuccess} role={notice.error ? 'alert' : 'status'}>{notice.error ? <EyeOff size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}<span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={15} /></button></div>}

          <div className={styles.mainGrid}>
            <section className={styles.collections} aria-labelledby="collections-title"><div className={styles.panelHeading}><div><p className={styles.eyebrow}>PHÂN LOẠI NỘI DUNG</p><h2 id="collections-title">Bộ sưu tập</h2></div><span>{categories.length}</span></div><p className={styles.panelDescription}>Ẩn bộ sưu tập sẽ ẩn các album trong đó khỏi trang portfolio.</p>
              {categories.length ? <div className={styles.collectionList}>{categories.map(category => {
                const categoryAlbums = albums.filter(item => item.category_id === category.id)
                return <article key={category.id} className={styles.collection}><div className={styles.collectionTop}><span className={styles.collectionIcon}><FolderOpen size={17} strokeWidth={1.4} aria-hidden="true" /></span><div><h3>{category.name}</h3><p>{categoryAlbums.length} album · {category.visible ? `${categoryAlbums.filter(item => item.is_public).length} public` : 'Đang ẩn'}</p></div><button type="button" role="switch" aria-checked={category.visible} aria-label={`${category.visible ? 'Ẩn' : 'Hiện'} bộ sưu tập ${category.name}`} disabled={readOnly || pending} className={styles.toggle} onClick={() => save(`category:${category.id}`, () => updateCategoryVisibility(category.id, !category.visible, category.visible), `Đã ${category.visible ? 'ẩn' : 'hiển thị'} bộ sưu tập ${category.name}.`)}>{pending && activeItem === `category:${category.id}` ? <Loader2 size={12} className={styles.spinner} /> : <span />}</button></div><div className={styles.collectionFooter}><button type="button" aria-pressed={categoryFilter === category.id} onClick={() => setCategoryFilter(categoryFilter === category.id ? 'all' : category.id)}>Lọc album <ArrowUpRight size={12} aria-hidden="true" /></button>{category.visible && <Link href={getPublicCategoryPath(category.slug)} target="_blank" rel="noopener noreferrer">Xem public <ArrowUpRight size={12} aria-hidden="true" /></Link>}</div></article>
              })}</div> : <div className={styles.emptyCollections}><FolderOpen size={24} aria-hidden="true" /><p>Chưa có bộ sưu tập.</p><Link href="/dashboardsp" prefetch={false}>Tạo bộ sưu tập <ArrowUpRight size={13} /></Link></div>}
              <Link href="/dashboardsp" prefetch={false} className={styles.manageCategories}>Thêm & sắp xếp bộ sưu tập <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </section>

            <section className={styles.albums} aria-labelledby="albums-title"><div className={styles.albumHeading}><div><p className={styles.eyebrow}>GÓC NHÌN CỦA STUDIO</p><h2 id="albums-title">Album & hiển thị</h2></div><Link href="/dashboardsp/photos" prefetch={false}>Chọn ảnh public <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
              <div className={styles.filters} role="group" aria-label="Lọc trạng thái album">{([{ key: 'all', label: 'Tất cả' }, { key: 'visible', label: 'Đang hiển thị' }, { key: 'hidden', label: 'Đang ẩn' }, { key: 'featured', label: 'Nổi bật' }] as { key: View; label: string }[]).map(item => <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => setView(item.key)}>{item.label}<span>{counts[item.key]}</span></button>)}</div>
              <div className={styles.searchRow}><label className={styles.search}><Search size={16} aria-hidden="true" /><span className="sr-only">Tìm album hoặc bộ sưu tập</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm album, bộ sưu tập…" /></label><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Lọc bộ sưu tập"><option value="all">Tất cả bộ sưu tập</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <p className={styles.resultCount} aria-live="polite">{filteredAlbums.length} album</p>
              {filteredAlbums.length ? <div className={styles.albumGrid}>{filteredAlbums.map(album => {
                const category = categories.find(item => item.id === album.category_id)
                const publicVisible = isVisible(album)
                return <article className={styles.albumCard} key={album.id}><div className={styles.albumImage}>{album.cover_url ? <ProductPreviewImage src={album.cover_url} alt={album.title} className={styles.coverImage} /> : <ImageIcon size={28} strokeWidth={1.2} aria-hidden="true" />}<span className={publicVisible ? styles.visibleBadge : styles.hiddenBadge}>{publicVisible ? <Eye size={11} aria-hidden="true" /> : <EyeOff size={11} aria-hidden="true" />}{publicVisible ? 'Đang hiển thị' : 'Đang ẩn'}</span><button type="button" disabled={readOnly || pending} aria-pressed={album.is_featured} title={album.is_featured ? 'Bỏ đánh dấu nổi bật' : 'Đánh dấu nổi bật'} aria-label={`${album.is_featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}: ${album.title}`} className={styles.featureButton} onClick={() => save(`featured:${album.id}`, () => updateAlbumPresentation(album.id, 'is_featured', !album.is_featured, album.is_featured), `Đã ${album.is_featured ? 'bỏ nhãn' : 'gắn nhãn'} nổi bật cho ${album.title}.`)}>{pending && activeItem === `featured:${album.id}` ? <Loader2 size={15} className={styles.spinner} /> : <Star size={15} fill={album.is_featured ? 'currentColor' : 'none'} />}</button></div><div className={styles.albumBody}><p className={styles.albumCategory}>{category?.name || 'Chưa có bộ sưu tập'}</p><h3>{album.title}</h3>{album.is_public && !publicVisible && <p className={styles.visibilityNote}>{category ? 'Bộ sưu tập đang ẩn trên portfolio.' : 'Thêm vào bộ sưu tập để xuất hiện trên portfolio.'}</p>}<div className={styles.albumActions}><button type="button" disabled={readOnly || pending} onClick={() => save(`album:${album.id}`, () => updateAlbumPresentation(album.id, 'is_public', !album.is_public, album.is_public), `Đã ${album.is_public ? 'ẩn' : 'bật public cho'} album ${album.title}.${!album.is_public && !publicVisible && category && !category.visible ? ' Bộ sưu tập vẫn đang ẩn.' : ''}`)}>{pending && activeItem === `album:${album.id}` ? <Loader2 size={14} className={styles.spinner} /> : album.is_public ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}{album.is_public ? 'Ẩn album' : 'Bật public'}</button>{album.is_public && <Link href={`/album-${encodeURIComponent(album.slug)}`} target="_blank" rel="noopener noreferrer">Xem album <ArrowUpRight size={13} aria-hidden="true" /></Link>}</div></div></article>
              })}</div> : <div className={styles.emptyAlbums}><ImageIcon size={29} strokeWidth={1.2} aria-hidden="true" /><h3>{albums.length ? 'Chưa tìm thấy album phù hợp' : 'Portfolio chờ câu chuyện đầu tiên'}</h3><p>{albums.length ? 'Thử đổi từ khóa hoặc bộ lọc để tìm album.' : 'Thêm album trong dashboard sản phẩm, sau đó chọn nội dung để chia sẻ.'}</p>{albums.length ? <button type="button" className={styles.secondaryButton} onClick={() => { setView('all'); setCategoryFilter('all'); setQuery('') }}>Đặt lại bộ lọc</button> : <Link href="/dashboardsp" prefetch={false} className={styles.secondaryButton}><Plus size={15} />Thêm album</Link>}</div>}
            </section>
          </div>
        </>}
      </div>
    </main>
  )
}
