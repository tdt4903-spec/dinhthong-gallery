import { Camera } from 'lucide-react'
import { SITE_LOGO_URL } from '@/lib/site-assets'

export default function SiteLogo({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <span role="img" aria-label="Dinh Thong Photos" className="inline-flex shrink-0 items-center gap-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isDarkMode ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-700/10 text-emerald-800'}`}>
        <Camera aria-hidden="true" className="h-[18px] w-[18px]" />
      </span>
      <span
      aria-hidden="true"
      className="block h-[25px] w-[72px] shrink-0 transition-colors duration-300 sm:h-[27px] sm:w-[90px]"
      style={{
        backgroundColor: isDarkMode ? '#f4fff8' : '#103b2c',
        maskImage: `url("${SITE_LOGO_URL}")`,
        WebkitMaskImage: `url("${SITE_LOGO_URL}")`,
        maskSize: '138% auto',
        WebkitMaskSize: '138% auto',
        maskPosition: '50% 54%',
        WebkitMaskPosition: '50% 54%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
      />
    </span>
  )
}
