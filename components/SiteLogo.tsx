import { SITE_LOGO_URL } from '@/lib/site-assets'

export default function SiteLogo({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <span
      role="img"
      aria-label="Dinh Thong Photos"
      className="block h-11 w-32 shrink-0 transition-colors duration-300 sm:h-12 sm:w-40"
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
  )
}
