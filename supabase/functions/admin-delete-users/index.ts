import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Json = Record<string, unknown>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) {
    return null
  }

  return user
}

async function isAdminUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('bathos_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify admin role: ${error.message}`)
  }

  return Boolean(data)
}

async function findUserByEmail(email: string) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list users: ${error.message}`)

    const users = data?.users ?? []
    const found = users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (found) return found

    if (users.length < perPage) break
    page += 1
  }

  return null
}

async function deleteUserData(userId: string) {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from('budget_household_members')
    .select('household_id')
    .eq('user_id', userId)

  if (membershipsError) throw new Error(`Failed to read household memberships: ${membershipsError.message}`)

  if (memberships && memberships.length > 0) {
    for (const m of memberships) {
      const { count, error: countError } = await supabaseAdmin
        .from('budget_household_members')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', m.household_id)

      if (countError) throw new Error(`Failed to count household members: ${countError.message}`)

      if (count === 1) {
        const { error: rpErr } = await supabaseAdmin.from('budget_restore_points').delete().eq('household_id', m.household_id)
        if (rpErr) throw new Error(`Failed to delete restore points: ${rpErr.message}`)

        const { error: expErr } = await supabaseAdmin.from('budget_expenses').delete().eq('household_id', m.household_id)
        if (expErr) throw new Error(`Failed to delete expenses: ${expErr.message}`)

        const { error: incErr } = await supabaseAdmin.from('budget_income_streams').delete().eq('household_id', m.household_id)
        if (incErr) throw new Error(`Failed to delete income streams: ${incErr.message}`)

        const { error: catErr } = await supabaseAdmin.from('budget_categories').delete().eq('household_id', m.household_id)
        if (catErr) throw new Error(`Failed to delete categories: ${catErr.message}`)

        const { error: laErr } = await supabaseAdmin.from('budget_linked_accounts').delete().eq('household_id', m.household_id)
        if (laErr) throw new Error(`Failed to delete linked accounts: ${laErr.message}`)

        const { error: hmErr } = await supabaseAdmin.from('budget_household_members').delete().eq('household_id', m.household_id)
        if (hmErr) throw new Error(`Failed to delete household members: ${hmErr.message}`)

        const { error: hhErr } = await supabaseAdmin.from('budget_households').delete().eq('id', m.household_id)
        if (hhErr) throw new Error(`Failed to delete household: ${hhErr.message}`)
      } else {
        const { error: memberErr } = await supabaseAdmin
          .from('budget_household_members')
          .delete()
          .eq('household_id', m.household_id)
          .eq('user_id', userId)
        if (memberErr) throw new Error(`Failed to delete user household membership: ${memberErr.message}`)
      }
    }
  }

  const { error: settingsErr } = await supabaseAdmin.from('bathos_user_settings').delete().eq('user_id', userId)
  if (settingsErr) throw new Error(`Failed to delete user settings: ${settingsErr.message}`)

  const { error: rolesErr } = await supabaseAdmin.from('bathos_user_roles').delete().eq('user_id', userId)
  if (rolesErr) throw new Error(`Failed to delete user roles: ${rolesErr.message}`)

  const { error: profileErr } = await supabaseAdmin.from('bathos_profiles').delete().eq('id', userId)
  if (profileErr) throw new Error(`Failed to delete user profile: ${profileErr.message}`)

  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authErr) throw new Error(`Failed to delete auth user: ${authErr.message}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requester = await getAuthenticatedUser(req)
    if (!requester) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
    }

    if (!(await isAdminUser(requester.id))) {
      return jsonResponse({ success: false, error: 'Forbidden' }, 403)
    }

    const payload = await req.json() as Json
    const singleEmail = typeof payload.email === 'string' ? payload.email.trim() : ''
    const multiEmails = Array.isArray(payload.emails)
      ? payload.emails.map((e) => String(e).trim()).filter(Boolean)
      : []
    const emails = multiEmails.length > 0 ? multiEmails : (singleEmail ? [singleEmail] : [])

    if (emails.length === 0) {
      return jsonResponse({ success: false, error: 'No emails provided' }, 400)
    }

    const results: Array<{ email: string; status: 'deleted' | 'not_found' | 'forbidden' | 'error'; detail?: string }> = []

    for (const email of emails) {
      try {
        if ((requester.email ?? '').toLowerCase() === email.toLowerCase()) {
          results.push({ email, status: 'forbidden', detail: 'You cannot delete your own account from this endpoint.' })
          continue
        }

        const user = await findUserByEmail(email)
        if (!user) {
          results.push({ email, status: 'not_found' })
          continue
        }
        await deleteUserData(user.id)
        results.push({ email, status: 'deleted' })
      } catch (err) {
        results.push({ email, status: 'error', detail: (err as Error).message })
      }
    }

    return jsonResponse({ success: true, results })
  } catch (error) {
    return jsonResponse({ success: false, error: (error as Error).message }, 500)
  }
})
