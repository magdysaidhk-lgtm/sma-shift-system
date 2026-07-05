export const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const AR_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'اربعاء', 'خميس', 'جمعة', 'سبت']
export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

export function weekdayOf(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getDay()
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateStrFor(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function monthLabel(year: number, month: number): string {
  return `جدول شهر ${AR_MONTHS[month - 1]} - ${year}`
}

export function hourLabel(h: number): string {
  const ampm = h >= 12 ? 'م' : 'ص'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}${ampm}`
}

export function hourInRange(h: number, startH: number | null, endH: number | null): boolean {
  if (startH == null || endH == null) return false
  return startH <= endH ? h >= startH && h < endH : h >= startH || h < endH
}

export function realTodayKey(): { year: number; month: number } {
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() + 1 }
}
