export type AlbumPhotoSort = 'default' | 'name-asc' | 'captured-asc' | 'captured-desc'

export type AlbumPhotoTimeMetadata = {
  /** EXIF DateTime from Drive imageMediaMetadata.time, when the image retains it. */
  capturedTime?: string
  createdTime?: string
  modifiedTime?: string
}

export const ALBUM_PHOTO_SORT_OPTIONS: ReadonlyArray<{ value: AlbumPhotoSort; label: string }> = [
  { value: 'default', label: 'Thứ tự hiện tại' },
  { value: 'name-asc', label: 'Tên ảnh: A–Z' },
  { value: 'captured-asc', label: 'Thời gian chụp: cũ → mới' },
  { value: 'captured-desc', label: 'Thời gian chụp: mới → cũ' },
]

const nameCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

/** Parse both EXIF DateTime (YYYY:MM:DD HH:mm:ss) and ISO timestamps consistently. */
export function getPhotoCaptureTimestamp(value?: string): number | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i)
  if (!match) return null

  const [, year, month, day, hour, minute, second, fraction = '', zone = 'Z'] = match
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  if (
    numericYear < 1000 || numericMonth < 1 || numericMonth > 12 ||
    numericDay < 1 || numericDay > new Date(Date.UTC(numericYear, numericMonth, 0)).getUTCDate() ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
  ) return null

  // EXIF usually has no zone. Keep its wall-clock order independent of the viewer's timezone.
  const normalizedZone = zone.toUpperCase().replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction.slice(0, 4)}${normalizedZone}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

/** Returns a new array; equal values keep the album's existing order. */
export function sortAlbumPhotos<T extends AlbumPhotoTimeMetadata & { name: string }>(
  items: readonly T[],
  sort: AlbumPhotoSort,
  getName: (item: T) => string = item => item.name,
): T[] {
  if (sort === 'default') return [...items]

  return items
    .map((item, index) => ({ item, index, name: getName(item).trim().normalize('NFC'), capturedAt: sort === 'name-asc' ? null : getPhotoCaptureTimestamp(item.capturedTime) }))
    .sort((a, b) => {
      const byName = () => nameCollator.compare(a.name, b.name) || a.index - b.index
      if (sort === 'name-asc') return byName()
      // Upload/edit times are not capture times. Missing or invalid EXIF stays last in both directions.
      if (a.capturedAt === null || b.capturedAt === null) {
        return a.capturedAt === b.capturedAt ? byName() : a.capturedAt === null ? 1 : -1
      }
      const difference = a.capturedAt - b.capturedAt
      return (sort === 'captured-desc' ? -difference : difference) || byName()
    })
    .map(({ item }) => item)
}
