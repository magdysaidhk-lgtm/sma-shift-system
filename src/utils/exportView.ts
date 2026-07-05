import type { ShiftType } from '../types/domain'

export interface ShiftSummary {
  workCounts: [string, number][]
  leaveCounts: [string, number][]
}

/** Splits a person's shift tally into "actual work" vs "leave/rest" buckets, using shiftTypes.isWorkable. */
export function summarizeShifts(
  shifts: Record<number, string> | undefined,
  shiftTypes: ShiftType[],
): ShiftSummary {
  const byCode = new Map(shiftTypes.map((s) => [s.code, s]))
  const counts: Record<string, number> = {}
  Object.values(shifts ?? {}).forEach((c) => {
    counts[c] = (counts[c] || 0) + 1
  })
  const entries = Object.entries(counts)
  return {
    workCounts: entries.filter(([code]) => byCode.get(code)?.isWorkable).sort((a, b) => b[1] - a[1]),
    leaveCounts: entries.filter(([code]) => !byCode.get(code)?.isWorkable).sort((a, b) => b[1] - a[1]),
  }
}

/** Which specific days (sorted) a person had a given shift code, within [from, to]. */
export function daysWithCode(
  shifts: Record<number, string> | undefined,
  code: string,
  from: number,
  to: number,
): number[] {
  const days: number[] = []
  for (let d = from; d <= to; d++) {
    if (shifts?.[d] === code) days.push(d)
  }
  return days
}
