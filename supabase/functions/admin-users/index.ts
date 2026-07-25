import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Admin panel backend: list every auth user with their family context, and
// delete a user together with the data that would otherwise be orphaned.
//
// This file was previously deployed but NOT in the repo, so the only copy lived
// in the Supabase dashboard. It is versioned here now.
//
// Two things it used to get wrong:
//
//   1. It built a second client from SUPABASE_ANON_KEY purely to verify the
//      caller. When that variable isn't injected, createClient throws before
//      any handler code runs and the whole request 500s with no message — which
//      is exactly what the users list started doing. The service-role client can
//      validate a JWT directly via auth.getUser(token), so the anon client (and
//      that entire failure mode) is gone.
//   2. Nothing was wrapped in try/catch, so any throw became an opaque 500. Every
//      failure now returns JSON with a reason the admin UI can display.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function fail(code: string, message: string, status: number) {
  return json({ error: code, message }, status)
}

// Supabase has been renaming the injected key variables (anon → publishable,
// service_role → secret). Accept either so a runtime rollover can't break this
// again the way it just did.
function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = Deno.env.get(n)
    if (v) return v
  }
  return undefined
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const supabaseUrl = env('SUPABASE_URL')
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY')
    const adminEmail = env('ADMIN_EMAIL') ?? 'hananel12345@gmail.com'

    if (!supabaseUrl || !serviceKey) {
      return fail(
        'missing_env',
        `Edge function is missing configuration (url:${Boolean(supabaseUrl)} key:${Boolean(serviceKey)})`,
        500,
      )
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── Verify the caller is the admin ──────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return fail('no_token', 'Missing Authorization header', 401)

    // Validating the token with the service client avoids needing an anon key.
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    const caller = userData?.user ?? null
    if (userErr || !caller) {
      return fail('invalid_token', userErr?.message ?? 'Could not resolve caller', 401)
    }
    if (caller.email !== adminEmail) {
      return fail('forbidden', 'Not an admin account', 403)
    }

    if (req.method === 'GET')    return await listUsers(admin)
    if (req.method === 'DELETE') return await deleteUser(admin, req, caller.id)

    return fail('method_not_allowed', `${req.method} is not supported`, 405)
  } catch (e) {
    // Anything unexpected still answers in JSON, with something actionable.
    const message = e instanceof Error ? e.message : String(e)
    return fail('unhandled', message, 500)
  }
})

// ── GET ───────────────────────────────────────────────────────────────────────

async function listUsers(admin: SupabaseClient) {
  // listUsers is paginated; walk it so the panel doesn't quietly truncate once
  // the project grows past one page.
  const authUsers: Record<string, unknown>[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return fail('list_users_failed', error.message, 500)
    const batch = data?.users ?? []
    authUsers.push(...batch)
    if (batch.length < 200) break
  }

  const [membersRes, eventCountsRes, familyStatsRes] = await Promise.all([
    admin
      .from('family_members')
      .select('id, auth_user_id, display_name, role, family_id, created_at, last_seen_at, family:families(id, name, code, created_at)'),
    admin.rpc('admin_member_event_counts'),
    admin.rpc('admin_family_stats'),
  ])

  if (membersRes.error) return fail('members_query_failed', membersRes.error.message, 500)

  const members = membersRes.data ?? []
  const eventsByMember: Record<string, number> = {}
  for (const row of (eventCountsRes.data ?? [])) {
    eventsByMember[row.member_id] = Number(row.event_count)
  }
  const statsByFamily: Record<string, Record<string, unknown>> = {}
  for (const row of (familyStatsRes.data ?? [])) {
    statsByFamily[row.family_id] = row
  }

  const membersByAuthId: Record<string, Record<string, unknown>> = {}
  for (const m of members) {
    if (m.auth_user_id) membersByAuthId[m.auth_user_id as string] = m
  }

  const result = authUsers.map((u) => {
    const member = membersByAuthId[u.id as string] ?? null
    const familyId = member?.family_id as string | undefined
    const famStats = familyId ? statsByFamily[familyId] : null
    const identities = (u.identities ?? []) as Record<string, unknown>[]

    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at ?? null,
      email_confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
      // Which sign-in method(s) — useful when a user says they "can't get in".
      providers: identities.map((i) => i.provider).filter(Boolean),
      full_name: (u.user_metadata as Record<string, unknown> | undefined)?.full_name ?? null,
      avatar_url: (u.user_metadata as Record<string, unknown> | undefined)?.avatar_url ?? null,
      member,
      stats: {
        // How much this person actually logged — the difference between a real
        // user and an account that was opened once and abandoned.
        events: member ? (eventsByMember[member.id as string] ?? 0) : 0,
        family_members: famStats ? Number(famStats.member_count) : 0,
        family_children: famStats ? Number(famStats.child_count) : 0,
        family_events: famStats ? Number(famStats.event_count) : 0,
        family_last_event_at: famStats ? famStats.last_event_at : null,
      },
    }
  })

  return json(result)
}

// ── DELETE ────────────────────────────────────────────────────────────────────

async function deleteUser(admin: SupabaseClient, req: Request, callerId: string) {
  const body = await req.json().catch(() => ({}))
  const userId = body?.userId
  if (!userId) return fail('missing_user_id', 'Body must include userId', 400)
  if (userId === callerId) return fail('self_delete', 'Cannot delete your own account', 400)

  const { data: member, error: memberErr } = await admin
    .from('family_members')
    .select('id, family_id')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (memberErr) return fail('member_lookup_failed', memberErr.message, 500)

  if (member) {
    const familyId = member.family_id

    // Keep the family's history: detach the events rather than deleting them,
    // so removing a grandparent doesn't erase the feeds they logged.
    await admin.from('events').update({ member_id: null }).eq('member_id', member.id)
    await admin.from('family_members').delete().eq('id', member.id)

    // If that was the last member, the family is now unreachable — tear it down
    // in FK order so nothing is left orphaned in the tables.
    const { count } = await admin
      .from('family_members')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', familyId)

    if ((count ?? 0) === 0) {
      await admin.from('events').delete().eq('family_id', familyId)
      await admin.from('trackers').delete().eq('family_id', familyId)
      await admin.from('children').delete().eq('family_id', familyId)
      await admin.from('families').delete().eq('id', familyId)
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId)
  if (delErr) return fail('delete_failed', delErr.message, 500)

  return json({ ok: true, deletedFamily: Boolean(member) })
}
