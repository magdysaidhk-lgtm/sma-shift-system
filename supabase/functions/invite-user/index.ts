// Deno Edge Function — creates a new login account and assigns its role.
// The anon key can't create Supabase Auth users, so this needs the service
// role key, which is only available server-side (same pattern as
// daily-backup). Deploy: supabase functions deploy invite-user
//
// IMPORTANT: Supabase's built-in email sending has strict rate limits on the
// free tier. If invites stop arriving, configure a custom SMTP provider in
// Supabase Dashboard -> Authentication -> Email, or use the "temporary
// password" fallback this function also supports (see body.password below).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace('Bearer ', '')

  // Verify the caller is a real, logged-in user (with the anon client + their JWT).
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(jwt)
  if (callerError || !callerData.user) {
    return new Response(JSON.stringify({ error: 'غير مصرح — سجّل دخولك.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Service-role client bypasses RLS — use it to check the caller's role and to act.
  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: callerProfile } = await admin
    .from('users')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin فقط يقدر يضيف حسابات جديدة.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { email, displayName, role, employeeId, password } = body as {
    email: string
    displayName: string
    role: 'admin' | 'shift_manager' | 'supervisor' | 'view_only'
    employeeId: string | null
    password?: string
  }

  if (!email || !displayName || !role) {
    return new Response(JSON.stringify({ error: 'البيانات ناقصة.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let userId: string
  if (password) {
    // Fallback for when email delivery isn't configured yet: create the
    // account directly with a temp password you share with the person.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: error?.message ?? 'تعذّر إنشاء الحساب.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = data.user.id
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
    })
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: error?.message ?? 'تعذّر إرسال الدعوة.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    userId = data.user.id
  }

  // The on_auth_user_created trigger already inserted a public.users row with
  // role='view_only' — update it with the real role/employee link now.
  const { error: updateError } = await admin
    .from('users')
    .update({ role, employee_id: employeeId, display_name: displayName })
    .eq('id', userId)

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, userId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
