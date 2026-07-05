// Deno Edge Function — runs server-side on Supabase, not part of the Vite client bundle.
// Deploy: supabase functions deploy daily-backup
// Schedule: Supabase Dashboard -> Edge Functions -> daily-backup -> Schedule (cron, e.g. "0 2 * * *")
// Required secrets (supabase secrets set):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role key never goes in the client app)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const TABLES = ['employees', 'shift_types', 'months', 'shift_assignments', 'settings', 'change_requests'] as const

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const tables: Record<string, unknown[]> = {}
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      return new Response(JSON.stringify({ ok: false, table, error: error.message }), { status: 500 })
    }
    tables[table] = data ?? []
  }

  const payload = { exportedAt: new Date().toISOString(), version: 1, tables }
  const filename = `backups/${payload.exportedAt.slice(0, 10)}.json`

  const { error: uploadError } = await supabase.storage
    .from('backups')
    .upload(filename, JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
      upsert: true,
    })

  if (uploadError) {
    return new Response(JSON.stringify({ ok: false, error: uploadError.message }), { status: 500 })
  }
  return new Response(JSON.stringify({ ok: true, filename }), { status: 200 })
})
