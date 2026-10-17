import { Camera } from 'lucide-react'

export default function SiteLogo({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 sm:gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 ${isDarkMode ? 'bg-emerald-400/10 text-emerald-300' : 'bg-[#005640] text-white'}`}>
        <Camera aria-hidden="true" className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <span className="min-w-0 text-left">
        <span className={`block whitespace-nowrap text-xs font-bold leading-tight sm:text-xl ${isDarkMode ? 'text-[#f4fff8]' : 'text-[#173b2c]'}`}>DinhThong Gallery</span>
        <span className={`mt-1 block whitespace-nowrap text-[7px] font-semibold uppercase tracking-[0.2em] sm:text-[9px] ${isDarkMode ? 'text-emerald-100/50' : 'text-[#91a69e]'}`}>Moment of life</span>
      </span>
    </span>
  )
}
