import Link from 'next/link'
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
} from 'lucide-react'

export default function CustomerProductsPublicPage() {
  return (
    <main className="min-h-screen bg-[#06110c] text-white">

      <header className="border-b border-white/[0.06] bg-[#06110c]/95">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10">
              <Camera className="h-5 w-5 text-emerald-300" />
            </div>

            <div>
              <div className="font-serif text-base font-semibold tracking-wide">
                Dinh Thong Gallery
              </div>

              <div className="text-[9px] uppercase tracking-[0.24em] text-white/35">
                Sản phẩm khách hàng
              </div>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-medium text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Trang chủ
          </Link>

        </div>
      </header>

      <section className="mx-auto max-w-[1450px] px-4 pb-16 pt-12 sm:px-6 lg:px-8">

        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300/70">
            Dinh Thong Gallery
          </p>

          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            Sản phẩm khách hàng
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
            Những bộ ảnh khách hàng thực tế được thực hiện bởi Dinh Thong.
            Tham khảo phong cách, concept và cách thể hiện trước khi book lịch chụp.
          </p>
        </div>

        <div className="mt-9 flex flex-wrap gap-2">
          <button className="rounded-full bg-emerald-400 px-5 py-2 text-[11px] font-bold text-[#062216]">
            Tất cả
          </button>

          {['Ảnh cưới', 'Couple', 'Kỷ yếu', 'Cá nhân', 'Gia đình'].map((item) => (
            <button
              key={item}
              className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-[11px] font-semibold text-white/55 transition hover:bg-white/[0.07]"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-[30px] border border-white/[0.08] bg-[#0a1710]/75 px-5 py-24 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04]">
            <ImageIcon className="h-7 w-7 text-emerald-300/55" />
          </div>

          <h2 className="mt-5 font-serif text-xl font-semibold">
            Sản phẩm khách hàng
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-white/35">
            Hiện chưa có album nào được publish.
          </p>
        </div>

      </section>
    </main>
  )
}
