'use client'

import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  Images,
  Layers3,
  Plus,
  Search,
  Eye,
  EyeOff,
  CalendarDays,
  Link2,
  MoreHorizontal,
} from 'lucide-react'

export default function CustomerProductsDashboard() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[#07130d] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">

        {/* TOP BAR */}
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/gallery')}
            className="inline-flex items-center gap-2 text-xs text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Gallery
          </button>

          <button
            type="button"
            onClick={() => window.open('/san-pham-khach-hang', '_blank')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#062216] transition hover:bg-emerald-300"
          >
            Web Publish
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        {/* HEADER */}
        <section className="mb-5 rounded-[28px] border border-white/10 bg-[#0b1911] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <div className="mb-3 flex items-center gap-2 text-emerald-300">
                <Images className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
                  Dinh Thong Gallery
                </span>
              </div>

              <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
                Sản phẩm khách hàng
              </h1>

              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/40">
                Quản lý những album và hình ảnh được đưa lên website
                Sản phẩm khách hàng.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold transition hover:bg-white/[0.08]"
              >
                <Layers3 className="h-4 w-4 text-emerald-300" />
                Thêm danh mục
              </button>

              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#07130d] transition hover:bg-white/90"
              >
                <Plus className="h-4 w-4" />
                Tạo album
              </button>
            </div>

          </div>
        </section>

        {/* STATS */}
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            title="Tổng album"
            value="0"
            icon={<Images className="h-4 w-4" />}
          />

          <Stat
            title="Ảnh hiển thị"
            value="0"
            icon={<Eye className="h-4 w-4" />}
          />

          <Stat
            title="Danh mục"
            value="0"
            icon={<Layers3 className="h-4 w-4" />}
          />

          <Stat
            title="Đang Public"
            value="0"
            icon={<ExternalLink className="h-4 w-4" />}
          />
        </section>

        {/* MAIN */}
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1911]">

          {/* TOOLBAR */}
          <div className="border-b border-white/[0.07] p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-bold text-[#062216]">
                  Tất cả
                </button>

                <button className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/50">
                  Ảnh cưới
                </button>

                <button className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/50">
                  Couple
                </button>

                <button className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/50">
                  Kỷ yếu
                </button>

                <button className="rounded-full border border-white/10 px-4 py-2 text-[11px] text-white/50">
                  Cá nhân
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 sm:w-[250px]">
                  <Search className="h-4 w-4 text-white/30" />

                  <input
                    placeholder="Tìm kiếm album..."
                    className="w-full bg-transparent text-xs outline-none placeholder:text-white/25"
                  />
                </div>

                <select className="h-10 rounded-xl border border-white/10 bg-[#0b1911] px-3 text-xs text-white/60 outline-none">
                  <option>Tất cả trạng thái</option>
                  <option>Đang Public</option>
                  <option>Đang ẩn</option>
                </select>
              </div>

            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">

              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-[0.12em] text-white/30">
                  <th className="px-5 py-4 font-medium">Ảnh bìa</th>
                  <th className="px-5 py-4 font-medium">Album</th>
                  <th className="px-5 py-4 font-medium">Danh mục</th>
                  <th className="px-5 py-4 font-medium">Link album</th>
                  <th className="px-5 py-4 font-medium">Ảnh hiển thị</th>
                  <th className="px-5 py-4 font-medium">Ngày thêm</th>
                  <th className="px-5 py-4 font-medium">Trạng thái</th>
                  <th className="px-5 py-4 text-right font-medium">Quản lý</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex flex-col items-center text-center">

                      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04]">
                        <Images className="h-7 w-7 text-emerald-300/60" />
                      </div>

                      <h3 className="mt-4 text-sm font-semibold">
                        Chưa có album nào
                      </h3>

                      <p className="mt-2 max-w-md text-[11px] leading-5 text-white/35">
                        Tạo album, thêm link album khách hàng và lựa chọn những
                        hình ảnh được phép hiển thị trên Web Publish.
                      </p>

                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#062216]"
                      >
                        <Plus className="h-4 w-4" />
                        Tạo album đầu tiên
                      </button>

                    </div>
                  </td>
                </tr>
              </tbody>

            </table>
          </div>

        </section>

        {/* BOTTOM INFO */}
        <section className="mt-5 grid gap-3 md:grid-cols-3">

          <InfoCard
            icon={<Link2 className="h-4 w-4" />}
            title="Link album"
            description="Mỗi album có thể sử dụng link nguồn riêng."
          />

          <InfoCard
            icon={<EyeOff className="h-4 w-4" />}
            title="Ẩn / Public"
            description="Album đang ẩn sẽ không xuất hiện ngoài website."
          />

          <InfoCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="Ngày thêm"
            description="Theo dõi thời điểm từng sản phẩm được đưa lên."
          />

        </section>

      </div>
    </main>
  )
}

function Stat({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0b1911] p-4">
      <div className="flex items-center justify-between text-white/35">
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </span>

        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          {icon}
        </div>
      </div>

      <div className="mt-3 text-2xl font-semibold">
        {value}
      </div>
    </div>
  )
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="text-emerald-300">
          {icon}
        </span>
        {title}
      </div>

      <p className="mt-2 text-[10px] leading-5 text-white/35">
        {description}
      </p>
    </div>
  )
}
