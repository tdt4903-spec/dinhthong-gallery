import { SITE_LOGO_URL } from '@/lib/site-assets'

export default function SiteLogo() {
  return (
    <span className="block h-11 w-32 overflow-hidden rounded-lg bg-[#071710] sm:h-12 sm:w-40">
      <img src={SITE_LOGO_URL} alt="Dinh Thong Photos" width={501} height={501} decoding="async" className="h-full w-full scale-[1.35] object-cover object-[50%_54%]" />
    </span>
  )
}
