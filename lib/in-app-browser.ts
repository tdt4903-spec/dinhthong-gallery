/**
 * Detects the built-in browsers of chat and social apps (Zalo, Facebook,
 * Messenger, Instagram, TikTok, Line...). They usually cannot hand photos to
 * the phone's "Save to Photos" sheet, so guests must reopen the album in
 * Safari or Chrome.
 */

export type InAppBrowser = {
  app: string
  platform: 'ios' | 'android' | 'other'
}

const APPS: [RegExp, string][] = [
  [/Zalo/i, 'Zalo'],
  [/MessengerForiOS|MessengerLite|\bOrca-Android\b|FB_IAB\/MESSENGER/i, 'Messenger'],
  // On iPhone, Messenger opens links in the same browser as Facebook (same
  // user agent), so the two cannot be told apart there.
  [/FBIOS|FBAN\/FBIOS/i, 'Facebook/Messenger'],
  [/FBAN|FBAV|FB_IAB|FB4A/i, 'Facebook'],
  [/Instagram/i, 'Instagram'],
  [/musical_ly|BytedanceWebview|TikTok|trill_/i, 'TikTok'],
  [/\bLine\//i, 'Line'],
  [/Telegram/i, 'Telegram'],
  [/Snapchat/i, 'Snapchat'],
  [/MicroMessenger/i, 'WeChat'],
]

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const ua = String(userAgent || '')
  const platform: InAppBrowser['platform'] = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other'
  for (const [pattern, app] of APPS) if (pattern.test(ua)) return { app, platform }
  // Generic Android WebView (most other apps' built-in browsers).
  if (platform === 'android' && /; wv\)/.test(ua)) return { app: 'ứng dụng', platform }
  return null
}

/** Where the app's own "open in browser" menu is, in one sentence. */
export function externalBrowserMenuStep(browser: InAppBrowser): string {
  const corner = browser.platform === 'android' ? 'biểu tượng ⋮ hoặc •••' : 'biểu tượng •••'
  if (/Facebook|Messenger|Instagram/.test(browser.app)) return `Bấm ${corner} ở góc trên bên phải → chọn “Mở trong trình duyệt ngoài”.`
  if (browser.app === 'Zalo') return `Bấm ${corner} ở góc trên bên phải → chọn “Mở bằng trình duyệt”.`
  if (browser.app === 'TikTok') return `Bấm ${corner} ở góc trên bên phải → chọn “Mở trong trình duyệt”.`
  return `Bấm ${corner} ở góc trên của màn hình → chọn “Mở bằng trình duyệt”.`
}

/** Ask the phone to reopen this page in its real browser. Some apps ignore it. */
export function openInExternalBrowser(browser: InAppBrowser, url = window.location.href): void {
  if (browser.platform === 'ios') window.location.href = iosSafariUrl(url)
  else if (browser.platform === 'android') window.location.href = androidChromeUrl(url)
}

/** Android: open this URL in Chrome (falls back to the system browser chooser). */
export function androidChromeUrl(url: string): string {
  const target = new URL(url)
  return `intent://${target.host}${target.pathname}${target.search}${target.hash}#Intent;scheme=${target.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
}

/** iOS 17+: ask the system to open this URL in Safari. Older iOS ignores it. */
export function iosSafariUrl(url: string): string {
  return url.replace(/^https:\/\//, 'x-safari-https://').replace(/^http:\/\//, 'x-safari-http://')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to a temporary text field below.
  }
  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  } catch {
    return false
  }
}
