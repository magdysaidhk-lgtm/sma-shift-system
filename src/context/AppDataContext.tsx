import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Employee, Month, Settings, ShiftType } from '../types/domain'
import { listEmployees } from '../services/employees'
import { listShiftTypes } from '../services/shiftTypes'
import { getSettings } from '../services/settingsService'
import { listMonths, createMonth, getMonth } from '../services/months'
import { listAssignmentsForMonth, type RosterMap } from '../services/shiftAssignments'
import { realTodayKey } from '../utils/dates'
import { useAuth } from '../auth/AuthContext'

interface AppDataState {
  loading: boolean
  employees: Employee[]
  shiftTypes: ShiftType[]
  settings: Settings
  months: Month[]
  currentMonth: Month | null
  roster: RosterMap
  setCurrentMonthId: (id: string) => void
  reloadRoster: () => Promise<void>
  reloadMonths: () => Promise<void>
  reloadEmployees: () => Promise<void>
  reloadShiftTypes: () => Promise<void>
  reloadSettings: () => Promise<void>
}

const AppDataContext = createContext<AppDataState | null>(null)

const EMPTY_SETTINGS: Settings = { allowedRestDays: [1, 2, 3, 4, 5], peakStartH: 19, peakEndH: 5 }

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS)
  const [months, setMonths] = useState<Month[]>([])
  const [currentMonthId, setCurrentMonthId] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterMap>({})

  const reloadEmployees = useCallback(async () => setEmployees(await listEmployees()), [])
  const reloadShiftTypes = useCallback(async () => setShiftTypes(await listShiftTypes()), [])
  const reloadSettings = useCallback(async () => setSettings(await getSettings()), [])

  const reloadMonths = useCallback(async () => {
    const list = await listMonths()
    setMonths(list)
    return list
  }, [])

  const reloadRoster = useCallback(async () => {
    if (!currentMonthId) {
      setRoster({})
      return
    }
    setRoster(await listAssignmentsForMonth(currentMonthId))
  }, [currentMonthId])

  // Initial load, mirroring the original app's loadDB(): auto-create the
  // real current month (empty roster) the first time it's ever opened.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await Promise.all([reloadEmployees(), reloadShiftTypes(), reloadSettings()])
      let list = await reloadMonths()

      const { year, month } = realTodayKey()
      let today = await getMonth(year, month)
      if (!today && list.length > 0) {
        today = await createMonth(year, month, user)
        list = await reloadMonths()
      }
      if (cancelled) return

      const pick = today ?? list[list.length - 1] ?? null
      setCurrentMonthId(pick?.id ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    reloadRoster()
  }, [reloadRoster])

  const currentMonth = months.find((m) => m.id === currentMonthId) ?? null

  return (
    <AppDataContext.Provider
      value={{
        loading,
        employees,
        shiftTypes,
        settings,
        months,
        currentMonth,
        roster,
        setCurrentMonthId,
        reloadRoster,
        reloadMonths: async () => {
          await reloadMonths()
        },
        reloadEmployees,
        reloadShiftTypes,
        reloadSettings,
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
