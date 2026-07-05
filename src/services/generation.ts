import type { Employee, ShiftType, Settings } from '../types/domain'
import type { RosterMap } from './shiftAssignments'
import { daysInMonth, weekdayOf, hourInRange } from '../utils/dates'

export interface GenConfig {
  employeeId: string
  name: string
  jobRole: string | null
  level: number
  include: boolean
  fixed: boolean
  fixedCode: string
  codes: string[]
  restDay: number
  lastShift: string | null
}

/**
 * Default set of shift codes a newly-configured employee rotates through.
 * N7 is deliberately excluded even though it's a real, selectable shift type —
 * the owner flagged its hours as unconfirmed, so it must never be auto-assigned
 * by generation (برومبت_Claude_Code: "لا تُفعّله في التوليد الرسمي حتى يحدده
 * المستخدم صراحة"). Admins can still hand-assign it via the grid cell editor.
 */
export function defaultWorkableCodes(shiftTypes: ShiftType[]): string[] {
  return shiftTypes.filter((s) => s.isWorkable && !s.needsConfirmation).map((s) => s.code)
}

/** Weekday (0-6) the employee was most often OFF in the given previous-month roster. */
export function mostCommonOffWeekday(
  prevShifts: Record<number, string> | undefined,
  year: number,
  month: number,
  allowedRestDays: number[],
): number {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  if (prevShifts) {
    Object.entries(prevShifts).forEach(([d, code]) => {
      if (code === 'OFF') counts[weekdayOf(year, month, Number(d))]++
    })
  }
  let best = allowedRestDays[0]
  allowedRestDays.forEach((i) => {
    if (counts[i] > counts[best]) best = i
  })
  return best
}

/** Last real work shift (not OFF/Y/ABS) the employee had in the given previous-month roster. */
export function lastActiveShift(
  prevShifts: Record<number, string> | undefined,
  year: number,
  month: number,
): string | null {
  if (!prevShifts) return null
  const nd = daysInMonth(year, month)
  for (let d = nd; d >= 1; d--) {
    const c = prevShifts[d]
    if (c && c !== 'OFF' && c !== 'Y' && c !== 'ABS') return c
  }
  return null
}

/** Round-robin rest-day spread within each job role, using only the allowed rest weekdays. */
export function spreadRestDaysByRole(configs: GenConfig[], allowedRestDays: number[]): GenConfig[] {
  const groups: Record<string, GenConfig[]> = {}
  configs.forEach((g) => {
    const key = g.jobRole || 'بدون دور'
    if (!groups[key]) groups[key] = []
    groups[key].push(g)
  })
  Object.values(groups).forEach((group) => {
    group.forEach((g, rank) => {
      g.restDay = allowedRestDays[rank % allowedRestDays.length]
    })
  })
  return configs
}

export function buildGenConfig(
  employees: Employee[],
  previousRoster: RosterMap,
  year: number,
  month: number,
  settings: Settings,
  shiftTypes: ShiftType[],
): GenConfig[] {
  const workCodes = defaultWorkableCodes(shiftTypes)
  // previousRoster is keyed by the *previous* month; caller passes shifted year/month for weekday math.
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const configs = employees.map((emp): GenConfig => {
    const prevShifts = previousRoster[emp.id]
    return {
      employeeId: emp.id,
      name: emp.name,
      jobRole: emp.jobRole,
      level: emp.level || 3,
      include: true,
      fixed: false,
      fixedCode: workCodes[0] || 'F',
      codes: emp.allowedShiftCodes && emp.allowedShiftCodes.length ? [...emp.allowedShiftCodes] : [...workCodes],
      restDay: mostCommonOffWeekday(prevShifts, prevYear, prevMonth, settings.allowedRestDays),
      lastShift: lastActiveShift(prevShifts, prevYear, prevMonth),
    }
  })
  return spreadRestDaysByRole(configs, settings.allowedRestDays)
}

export function generateSchedule(year: number, month: number, configs: GenConfig[]): RosterMap {
  const nd = daysInMonth(year, month)
  const roster: RosterMap = {}

  const included = configs.filter((g) => g.include)
  const rotating = included.filter((g) => !g.fixed).sort((a, b) => b.level - a.level)
  const rankOf = new Map(rotating.map((g, i) => [g, i]))

  included.forEach((g) => {
    const shifts: Record<number, string> = {}
    if (g.fixed) {
      for (let d = 1; d <= nd; d++) {
        const wd = weekdayOf(year, month, d)
        shifts[d] = wd === g.restDay ? 'OFF' : g.fixedCode
      }
    } else {
      const codes = g.codes.length ? g.codes : ['F']
      let baseStartIdx = 0
      if (g.lastShift && codes.includes(g.lastShift)) {
        baseStartIdx = (codes.indexOf(g.lastShift) + 1) % codes.length
      }
      const rankOffset = codes.length > 1 ? rankOf.get(g) ?? 0 : 0
      const startIdx = (baseStartIdx + rankOffset) % codes.length
      let restCount = 0
      for (let d = 1; d <= nd; d++) {
        const wd = weekdayOf(year, month, d)
        if (wd === g.restDay) {
          shifts[d] = 'OFF'
          restCount++
        } else {
          shifts[d] = codes[(startIdx + restCount) % codes.length]
        }
      }
    }
    roster[g.employeeId] = shifts
  })

  return roster
}

// ---------------------------------------------------------------------------
// Review report (new requirement): surfaces coverage gaps, consecutive-day
// violations, and morning-after-night conflicts before a month is approved.
// ---------------------------------------------------------------------------
export interface ReviewIssue {
  severity: 'critical' | 'warning'
  type: 'consecutive_days' | 'morning_after_night' | 'low_coverage'
  employeeId?: string
  employeeName?: string
  day?: number
  detail: string
}

export interface ReviewReport {
  issues: ReviewIssue[]
  shiftCountsByEmployee: Record<string, Record<string, number>>
}

export function buildReviewReport(
  roster: RosterMap,
  employees: Pick<Employee, 'id' | 'name'>[],
  year: number,
  month: number,
  settings: Settings,
  shiftTypes: ShiftType[],
): ReviewReport {
  const hoursByCode = new Map(shiftTypes.map((s) => [s.code, { startHour: s.startHour, endHour: s.endHour }]))
  const nd = daysInMonth(year, month)
  const issues: ReviewIssue[] = []
  const shiftCountsByEmployee: Record<string, Record<string, number>> = {}
  const empName = new Map(employees.map((e) => [e.id, e.name]))

  // Per-employee: consecutive workdays > 6, and F immediately after N/N3.
  Object.entries(roster).forEach(([employeeId, shifts]) => {
    const counts: Record<string, number> = {}
    let streak = 0
    for (let d = 1; d <= nd; d++) {
      const code = shifts[d]
      if (code) counts[code] = (counts[code] || 0) + 1
      const isWorkday = Boolean(code) && !['OFF', 'Y', 'ABS'].includes(code)
      if (isWorkday) {
        streak++
        if (streak === 7) {
          issues.push({
            severity: 'critical',
            type: 'consecutive_days',
            employeeId,
            employeeName: empName.get(employeeId),
            day: d,
            detail: `${empName.get(employeeId) ?? ''}: أكثر من 6 أيام عمل متتالية (حتى يوم ${d})`,
          })
        }
      } else {
        streak = 0
      }

      if (d > 1) {
        const prevCode = shifts[d - 1]
        if ((prevCode === 'N' || prevCode === 'N3') && code === 'F') {
          issues.push({
            severity: 'critical',
            type: 'morning_after_night',
            employeeId,
            employeeName: empName.get(employeeId),
            day: d,
            detail: `${empName.get(employeeId) ?? ''}: شيفت صباحي (F) مباشرة بعد شيفت ليلي (${prevCode}) يوم ${d}`,
          })
        }
      }
    }
    shiftCountsByEmployee[employeeId] = counts
  })

  // Per-day peak-window coverage.
  for (let d = 1; d <= nd; d++) {
    let minCoverage = Infinity
    for (let h = 0; h < 24; h++) {
      if (!hourInRange(h, settings.peakStartH, settings.peakEndH)) continue
      let count = 0
      Object.values(roster).forEach((shifts) => {
        const code = shifts[d]
        const hours = code ? hoursByCode.get(code) : undefined
        if (hours && hourInRange(h, hours.startHour, hours.endHour)) count++
      })
      minCoverage = Math.min(minCoverage, count)
    }
    if (minCoverage === 0) {
      issues.push({ severity: 'critical', type: 'low_coverage', day: d, detail: `يوم ${d}: عجز تغطية كامل في وقت الضغط` })
    } else if (minCoverage === 1) {
      issues.push({ severity: 'warning', type: 'low_coverage', day: d, detail: `يوم ${d}: تغطية وقت الضغط شخص واحد فقط` })
    }
  }

  return { issues, shiftCountsByEmployee }
}
