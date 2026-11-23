export type PeoplePriceTier = {
  min: number
  max: number | null
  price: number
}

export function validatePeopleTiers(tiers: PeoplePriceTier[]): string | null {
  if (!tiers.length) return 'Thêm ít nhất một khoảng giá theo số người.'
  const sorted = [...tiers].sort((a, b) => a.min - b.min)
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i]
    if (!Number.isSafeInteger(tier.min) || tier.min < 1 || tier.min > 2147483647 ||
        (tier.max !== null && (!Number.isSafeInteger(tier.max) || tier.max < tier.min || tier.max > 2147483647))) {
      return 'Số người phải là số nguyên dương; đến phải lớn hơn hoặc bằng từ.'
    }
    if (!Number.isSafeInteger(tier.price) || tier.price <= 0 || tier.price > 1000000000) {
      return 'Đơn giá phải là số nguyên từ 1 đến 1.000.000.000 ₫.'
    }
    if (i > 0 && (sorted[i - 1].max === null || tier.min <= sorted[i - 1].max!)) {
      return 'Các khoảng số người không được trùng nhau, ví dụ: 1–2, 3–4, 5 trở lên.'
    }
  }
  return null
}

export function quotePeople(tiers: PeoplePriceTier[], people: number) {
  if (!Number.isSafeInteger(people) || people < 1 || people > 2147483647 || validatePeopleTiers(tiers)) return null
  const tier = tiers.find(item => people >= item.min && (item.max === null || people <= item.max))
  if (!tier || !Number.isSafeInteger(people * tier.price)) return null
  return { unitPrice: tier.price, total: people * tier.price }
}

// Entry 0 is the surcharge for session 2; all surcharges use the first-session price.
export function validateSessionPercentages(percentages: number[]): string | null {
  if (percentages.some(percent => !Number.isSafeInteger(percent) || percent < 0 || percent > 10000)) {
    return 'Phần trăm mỗi buổi phải là số nguyên từ 0 đến 10.000%.'
  }
  return null
}

export function quoteSessions(basePrice: number, percentages: number[], count: number) {
  if (!Number.isSafeInteger(basePrice) || basePrice < 0 || !Number.isSafeInteger(count) ||
      count < 1 || count > percentages.length + 1 || validateSessionPercentages(percentages)) return null
  const percent = 100 + percentages.slice(0, count - 1).reduce((sum, value) => sum + value, 0)
  const total = Number((BigInt(basePrice) * BigInt(percent) + BigInt(99)) / BigInt(100))
  if (!Number.isSafeInteger(total)) return null
  return { basePrice, percent, extra: total - basePrice, total }
}
