import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    // Use service role to delete user data and auth account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete budget module data (household memberships, which cascades access)
    // First get user's household memberships
    const { data: memberships } = await supabaseAdmin
      .from('budget_household_members')
      .select('household_id')
      .eq('user_id', userId)

    if (memberships && memberships.length > 0) {
      for (const m of memberships) {
        // Check if user is the only member
        const { count } = await supabaseAdmin
          .from('budget_household_members')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', m.household_id)

        if (count === 1) {
          // Solo household — delete all household data
          await supabaseAdmin.from('budget_restore_points').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_expenses').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_income_streams').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_categories').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_linked_accounts').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_household_members').delete().eq('household_id', m.household_id)
          await supabaseAdmin.from('budget_households').delete().eq('id', m.household_id)
        } else {
          // Shared household — just remove membership
          await supabaseAdmin.from('budget_household_members').delete()
            .eq('household_id', m.household_id)
            .eq('user_id', userId)
        }
      }
    }

    // Delete platform data
    await supabaseAdmin.from('bathos_user_settings').delete().eq('user_id', userId)
    await supabaseAdmin.from('bathos_user_roles').delete().eq('user_id', userId)
    await supabaseAdmin.from('bathos_profiles').delete().eq('id', userId)

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      throw new Error(`Failed to delete auth user: ${deleteError.message}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message, success: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
