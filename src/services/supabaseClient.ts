import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// When not configured yet (no Supabase account linked), export a harmless
// client pointed at a placeholder — nothing calls it because every service
// function checks `isSupabaseConfigured` first and falls back to the local
// in-memory mock store instead.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
