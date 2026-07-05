import { supabase, isSupabaseConfigured } from './supabaseClient'
import { getDB, mutate } from './mock/store'
import type { Settings } from '../types/domain'

export async function getSettings(): Promise<Settings> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('settings')
      .select('allowed_rest_days, peak_start_h, peak_end_h')
      .eq('id', true)
      .single()
    if (error) throw error
    return { allowedRestDays: data.allowed_rest_days, peakStartH: data.peak_start_h, peakEndH: data.peak_end_h }
  }
  return getDB().settings
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('settings')
      .update({
        allowed_rest_days: patch.allowedRestDays,
        peak_start_h: patch.peakStartH,
        peak_end_h: patch.peakEndH,
      })
      .eq('id', true)
    if (error) throw error
    return
  }
  mutate((db) => {
    Object.assign(db.settings, patch)
  })
}
