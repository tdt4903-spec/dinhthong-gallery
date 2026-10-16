export type AlbumFeatures = {
  password: string
  max_select: number
  enable_watermark: boolean
}

export const DEFAULT_ALBUM_FEATURES: Readonly<AlbumFeatures> = Object.freeze({
  password: '',
  max_select: 0,
  enable_watermark: false,
})

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeAlbumFeatures(input?: unknown): AlbumFeatures {
  const settings = isSettingsRecord(input) ? input : {}
  const limit = settings.max_select

  return {
    password: typeof settings.password === 'string' ? settings.password.trim() : '',
    max_select: typeof limit === 'number' && Number.isSafeInteger(limit) && limit > 0 ? limit : 0,
    enable_watermark: settings.enable_watermark === true,
  }
}

/** An existing folder row is authoritative, including empty and disabled values. */
export function resolveAlbumFeatures(
  folderId: string,
  ownSettings?: unknown,
  album?: {
    id: string | number
    password?: unknown
    max_select?: unknown
    enable_watermark?: unknown
  } | null,
): AlbumFeatures {
  if (isSettingsRecord(ownSettings)) return normalizeAlbumFeatures(ownSettings)
  if (album && String(album.id) === String(folderId)) return normalizeAlbumFeatures(album)
  return { ...DEFAULT_ALBUM_FEATURES }
}
