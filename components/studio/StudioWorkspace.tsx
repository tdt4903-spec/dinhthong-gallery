'use client'

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePageScrollLock } from '@/lib/use-page-scroll-lock'
import { Aperture, ArrowUpRight, CalendarDays, ChevronRight, FolderOpen, Image, KeyRound, Menu, PanelLeftClose, PanelLeftOpen, PanelsTopLeft, ShieldCheck, Wallet, X } from 'lucide-react'
import StudioAccount from './StudioAccount'

const navigation = [
  { href: '/dashboardadmin', label: 'Gallery nội bộ', description: 'Album & lựa chọn ảnh', icon: FolderOpen },
  { href: '/dashboardpublic', label: 'Quản trị web public', description: 'Nội dung hiển thị trên portfolio', icon: PanelsTopLeft },
  { href: '/dashboardsp', label: 'Sản phẩm', description: 'Danh mục & thư viện sản phẩm', icon: Image },
  { href: '/dashboardsp/booking', label: 'Booking', description: 'Lịch chụp & khách hàng', icon: CalendarDays },
  { href: '/money', label: 'Thu chi', description: 'Giao dịch & báo cáo', icon: Wallet },
  { href: '/dashboardadmin?panel=keys', label: 'Key Panel', description: 'Bản quyền & thiết bị', icon: KeyRound },
]

export default function StudioWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('gallery-sidebar-hidden') === 'true') } catch {}
    const desktop = matchMedia('(min-width: 1024px)')
    const closeMobileMenu = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeMobileMenu)
    return () => desktop.removeEventListener('change', closeMobileMenu)
  }, [])
  function toggleSidebar() {
    setCollapsed(!collapsed)
    try { localStorage.setItem('gallery-sidebar-hidden', String(!collapsed)) } catch {}
  }
  const [keyPanelOpen, setKeyPanelOpen] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  usePageScrollLock(menuOpen)

  useEffect(() => {
    const update = () => setKeyPanelOpen(pathname === '/dashboardadmin' && new URLSearchParams(window.location.search).get('panel') === 'keys')
    const openKeys = () => setKeyPanelOpen(true)
    const closeKeys = () => setKeyPanelOpen(false)
    update()
    window.addEventListener('popstate', update)
    window.addEventListener('studio:open-key-panel', openKeys)
    window.addEventListener('studio:close-key-panel', closeKeys)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('studio:open-key-panel', openKeys)
      window.removeEventListener('studio:close-key-panel', closeKeys)
    }
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    menuRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
      if (event.key !== 'Tab') return
      const items = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [menuOpen])

  const isActive = (href: string) => {
    if (href.includes('?')) return pathname === '/dashboardadmin' && keyPanelOpen
    if (href === '/dashboardadmin') return pathname === href && !keyPanelOpen
    if (href === '/dashboardsp') return pathname === href || pathname.startsWith('/dashboardsp/photos')
    return pathname === href
  }
  const current = navigation.find(item => isActive(item.href)) || navigation[0]

  const openKeyPanel = (event: MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false)
    if (pathname !== '/dashboardadmin' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const url = new URL(window.location.href)
    url.searchParams.set('panel', 'keys')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    window.dispatchEvent(new Event('studio:open-key-panel'))
  }

  return (
    <div className="studio-workspace" data-sidebar-hidden={collapsed}>
      <a className="workspace-skip" href="#studio-workspace-content">Đến nội dung chính</a>
      {menuOpen && <button type="button" className="workspace-backdrop" onClick={() => setMenuOpen(false)} aria-label="Đóng menu quản trị" />}
      <aside ref={menuRef} id="studio-navigation" className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar-open' : ''}`} aria-label="Điều hướng quản trị" role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen ? true : undefined}>
        <div className="workspace-brand-row">
          <Link href="/dashboardadmin" className="workspace-brand" onClick={() => setMenuOpen(false)} aria-label="Dinh Thong Gallery — Gallery nội bộ">
            <span className="workspace-brand-mark"><Aperture size={25} strokeWidth={1.4} aria-hidden="true" /></span>
            <span><strong>Dinh Thong Gallery</strong></span>
          </Link>
          <button type="button" className="workspace-close" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><X size={20} /></button>
        </div>

        <div className="workspace-studio-label"><span className="workspace-status-dot" />Không gian quản trị<ShieldCheck size={13} aria-hidden="true" /></div>
        <p className="workspace-nav-heading">KHÔNG GIAN LÀM VIỆC</p>
        <nav className="workspace-navigation" aria-label="Công cụ studio">
          {navigation.map(item => {
            const Icon = item.icon
            const content = <><Icon size={19} strokeWidth={1.6} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={14} aria-hidden="true" /></>
            const className = `workspace-nav-item ${isActive(item.href) ? 'workspace-nav-active' : ''}`
            return item.href.includes('?') || (item.href === '/dashboardadmin' && keyPanelOpen) ? (
              <a key={item.href} href={item.href} className={className} aria-current={isActive(item.href) ? 'page' : undefined} onClick={item.href.includes('?') ? openKeyPanel : () => setMenuOpen(false)}>{content}</a>
            ) : (
              <Link key={item.href} href={item.href} prefetch={item.href === '/dashboardpublic' ? null : false} className={className} aria-current={isActive(item.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{content}</Link>
            )
          })}
        </nav>

        <StudioAccount />
      </aside>

      <div className="workspace-body">
        <div className="workspace-topbar">
          <div className="workspace-breadcrumb"><button ref={menuButtonRef} type="button" className="workspace-menu" onClick={() => setMenuOpen(true)} aria-label="Mở menu quản trị" aria-controls="studio-navigation" aria-expanded={menuOpen}><Menu size={21} /></button><button type="button" className="workspace-desktop-toggle" onClick={toggleSidebar} aria-expanded={!collapsed} aria-controls="studio-navigation" aria-label={collapsed ? 'Hiện sidebar' : 'Ẩn sidebar'} title={collapsed ? 'Hiện sidebar' : 'Ẩn sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><span>Quản trị</span><ChevronRight size={13} aria-hidden="true" /><strong>{current.label}</strong></div>
          <div className="workspace-topbar-actions"><span className="workspace-admin-badge"><ShieldCheck size={12} aria-hidden="true" />Quản trị</span><Link href="/" target="_blank" rel="noopener noreferrer">Portfolio<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        </div>
        <div id="studio-workspace-content" className="workspace-content" tabIndex={-1}>{children}</div>
      </div>
    </div>
  )
}
