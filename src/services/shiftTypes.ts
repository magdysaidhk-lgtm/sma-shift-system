import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'
import type { ShiftType } from '../types/domain'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToShiftType(row: any): ShiftType {
  return {
    code: row.code,
    description: row.description,
    color: row.color,
    textColor: row.text_color,
    startHour: row.start_hour,
    endHour: row.end_hour,
    isWorkable: row.is_workable,
    needsConfirmation: row.needs_confirmation,
  }
}

export async function listShiftTypes(): Promise<ShiftType[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('shift_types').select('*').order('code')
    if (error) throw error
    return (data ?? []).map(rowToShiftType)
  }
  return getDB().shiftTypes
}

export async function upsertShiftType(shift: ShiftType): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('shift_types').upsert({
      code: shift.code,
      description: shift.description,
      color: shift.color,
      text_color: shift.textColor,
      start_hour: shift.startHour,
      end_hour: shift.endHour,
      is_workable: shift.isWorkable,
      needs_confirmation: shift.needsConfirmation,
    })
    if (error) throw error
    return
  }
  mutate((db) => {
    const idx = db.shiftTypes.findIndex((s) => s.code === shift.code)
    if (idx >= 0) db.shiftTypes[idx] = shift
    else db.shiftTypes.push(shift)
  })
}

export async function deleteShiftType(code: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('shift_types').delete().eq('code', code)
    if (error) throw error
    return
  }
  mutate((db) => {
    db.shiftTypes = db.shiftTypes.filter((s) => s.code !== code)
  })
}
