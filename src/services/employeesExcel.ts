import type { Employee } from '../types/domain'
import { AR_DAYS } from '../utils/dates'

const HEADERS = ['الاسم', 'الدور', 'المستوى', 'الرقم الشخصي', 'رقم الشغل', 'اسم الجروب / الواتساب', 'يوم الإجازة الثابت']

export async function exportEmployeesToExcel(employees: Employee[]): Promise<void> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const rows = [
    HEADERS.map((h) => ({ value: h, fontWeight: 'bold' as const })),
    ...employees.map((e) => [
      { value: e.name },
      { value: e.jobRole ?? '' },
      { value: e.level ?? 3 },
      { value: e.nationalId ?? '' },
      { value: e.workNumber ?? '' },
      { value: e.groupName ?? '' },
      { value: e.fixedRestDay != null ? AR_DAYS[e.fixedRestDay] : '' },
    ]),
  ]
  await writeXlsxFile(rows).toFile('قالب-الموظفين.xlsx')
}

export interface ParsedEmployeeRow {
  name: string
  jobRole: string | null
  level: number
  nationalId: string | null
  workNumber: string | null
  groupName: string | null
  fixedRestDay: number | null
}

function cellStr(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

export async function parseEmployeesExcel(file: File): Promise<ParsedEmployeeRow[]> {
  const { readSheet } = await import('read-excel-file/browser')
  const dataRows = (await readSheet(file)).slice(1) // skip header row

  const rows: ParsedEmployeeRow[] = []
  dataRows.forEach((row) => {
    const name = cellStr(row[0])
    if (!name) return
    const restDayName = cellStr(row[6])
    const restDayIdx = AR_DAYS.findIndex((d) => d === restDayName)
    rows.push({
      name,
      jobRole: cellStr(row[1]) || null,
      level: Number(cellStr(row[2])) || 3,
      nationalId: cellStr(row[3]) || null,
      workNumber: cellStr(row[4]) || null,
      groupName: cellStr(row[5]) || null,
      fixedRestDay: restDayIdx >= 0 ? restDayIdx : null,
    })
  })
  return rows
}
