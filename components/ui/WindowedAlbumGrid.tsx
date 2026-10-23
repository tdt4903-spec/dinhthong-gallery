'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

type GridWindow = { columns: number; rowHeight: number; gap: number; start: number; end: number }

/** Keep one continuous page and a full logical photo list, but bound mounted
 * image elements/decoded previews to the viewport on memory-limited phones. */
export default function WindowedAlbumGrid({ children, className, itemAspect = 4 / 5, scrollRoot }: {
  children: ReactNode[]
  className: string
  itemAspect?: number
  scrollRoot?: RefObject<HTMLElement | null>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [windowState, setWindowState] = useState<GridWindow>({ columns: 2, rowHeight: 280, gap: 10, start: 0, end: 16 })
  const virtual = children.length > 160
  useEffect(() => {
    if (!virtual) return
    const host = hostRef.current, grid = gridRef.current
    if (!host || !grid) return
    const scroller = scrollRoot?.current
    let frame = 0
    const measure = () => {
      frame = 0
      const style = getComputedStyle(grid)
      const columns = Math.max(1, style.gridTemplateColumns.split(/\s+/).filter(Boolean).length)
      const gap = parseFloat(style.rowGap) || 0
      const firstCard = grid.firstElementChild as HTMLElement | null
      const rowHeight = firstCard?.getBoundingClientRect().height || (host.clientWidth / columns) / itemAspect + 80
      const pitch = rowHeight + gap
      const rect = host.getBoundingClientRect()
      const viewportTop = scroller?.getBoundingClientRect().top || 0
      const viewportBottom = viewportTop + (scroller?.clientHeight || window.innerHeight)
      const rows = Math.ceil(children.length / columns)
      const firstVisible = Math.max(0, Math.floor((viewportTop - rect.top) / pitch))
      const lastVisible = Math.max(firstVisible + 1, Math.ceil((viewportBottom - rect.top) / pitch))
      const start = Math.min(Math.max(0, rows - 1), Math.max(0, firstVisible - 4))
      const end = Math.min(rows, Math.max(start + 1, lastVisible + 4))
      setWindowState(previous => previous.columns === columns && Math.abs(previous.rowHeight - rowHeight) < 0.5 && previous.gap === gap && previous.start === start && previous.end === end ? previous : { columns, rowHeight, gap, start, end })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : undefined
    observer?.observe(host)
    if (grid.firstElementChild) observer?.observe(grid.firstElementChild)
    if (scroller) observer?.observe(scroller)
    const target = scroller || window
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    measure()
    return () => {
      observer?.disconnect()
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [virtual, children.length, itemAspect, scrollRoot])

  if (!virtual) return <div className={className}>{children}</div>
  const { columns, rowHeight, gap, start, end } = windowState
  const rows = Math.ceil(children.length / columns)
  const startRow = Math.min(start, Math.max(0, rows - 1))
  const endRow = Math.min(rows, Math.max(startRow + 1, end))
  return <div ref={hostRef} className="relative w-full" style={{ height: Math.max(0, rows * (rowHeight + gap) - gap), overflowAnchor: 'none' }}>
    <div ref={gridRef} className={className} style={{ position: 'absolute', top: startRow * (rowHeight + gap), left: 0, right: 0 }}>
      {children.slice(startRow * columns, endRow * columns)}
    </div>
  </div>
}
