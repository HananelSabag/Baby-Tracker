import { startOfDay, endOfDay } from 'date-fns'
import { supabase } from './supabase'

// The single gateway for every Supabase read/write in the app.
//
// Why this exists — with no backend, each component talked to Supabase itself.
// That produced three problems that only show up once there's real data:
//
//   1. Duplicate reads. The home page ran one query for the day's events, then
//      every tracker card ran its own query for a *subset of the same rows*.
//      Six trackers meant seven round trips returning overlapping data.
//   2. No shared cache, so remounting a page re-fetched everything.
//   3. Over-fetching. Events were selected as `*` plus three `(*)` joins, one of
//      which (children) was never read by any screen.
//
// Everything below funnels through `query()`, which deduplicates concurrent
// identical requests and caches results briefly. Realtime invalidation (see
// hooks/useRealtimeQuery) is what actually keeps data fresh; the TTL is only a
// safety net for a dropped socket.

// ── Column sets ──────────────────────────────────────────────────────────────
// Explicit, and checked against what the screens actually read. `*` here is a
// per-row tax on every list in the app.

const EVENT_COLS = 'id, tracker_id, member_id, child_id, data, notes, occurred_at, created_at'
const TRACKER_JOIN = 'tracker:trackers(id, name, icon, color, tracker_type, field_schema, is_active)'
const MEMBER_JOIN  = 'member:family_members(id, display_name, avatar_url, role)'

// ── Request layer: dedupe + short-lived cache ────────────────────────────────

const DEFAULT_TTL_MS = 30_000

const cache = new Map()    // key -> { value, expiresAt }
const inflight = new Map() // key -> Promise

/**
 * Run `fetcher` under `key`, sharing the result with any concurrent caller and
 * reusing a fresh cached value.
 *
 * The dedupe half is the important one: five tracker cards mounting in the same
 * tick collapse into a single network request instead of five.
 */
export async function query(key, fetcher, { ttl = DEFAULT_TTL_MS, force = false } = {}) {
  if (!force) {
    const hit = cache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.value

    const pending = inflight.get(key)
    if (pending) return pending
  }

  const promise = (async () => {
    try {
      const value = await fetcher()
      cache.set(key, { value, expiresAt: Date.now() + ttl })
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

/** Drop every cache entry whose key starts with `prefix`. */
export function invalidate(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export function invalidateAll() {
  cache.clear()
  inflight.clear()
}

// Test/debug visibility.
export const __cache = { cache, inflight }

// ── Cache keys ───────────────────────────────────────────────────────────────

const dayKey = date => {
  const d = date instanceof Date ? date : new Date(date)
  // Local calendar day, not UTC — a 01:00 feed belongs to that local date.
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export const keys = {
  eventsAll:   familyId => `events:${familyId}:`,
  eventsDay:   (familyId, childId, date) => `events:${familyId}:day:${childId ?? 'all'}:${dayKey(date)}`,
  eventsRange: (familyId, childId, start, end, trackerId) =>
    `events:${familyId}:range:${childId ?? 'all'}:${start.toISOString()}:${end.toISOString()}:${trackerId ?? 'all'}`,
  trackers:    familyId => `trackers:${familyId}`,
  children:    familyId => `children:${familyId}`,
  members:     familyId => `members:${familyId}`,
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

// ── Events ───────────────────────────────────────────────────────────────────

export const events = {
  /**
   * Every event for one child on one local calendar day.
   *
   * This is the single read behind the whole home page. Tracker cards filter
   * this result in memory rather than each issuing their own query — that is
   * what collapses N requests into one.
   */
  listDay(familyId, childId, date) {
    if (!familyId) return Promise.resolve([])
    return query(keys.eventsDay(familyId, childId, date), async () => {
      let q = supabase
        .from('events')
        .select(EVENT_COLS)
        .eq('family_id', familyId)
        .gte('occurred_at', startOfDay(date).toISOString())
        .lte('occurred_at', endOfDay(date).toISOString())
        .order('occurred_at', { ascending: false })
      if (childId) q = q.eq('child_id', childId)
      return unwrap(await q) ?? []
    })
  },

  /** A date range, with the tracker/member joins the history + report screens need. */
  listRange(familyId, childId, { start, end, trackerId, withRelations = true } = {}) {
    if (!familyId) return Promise.resolve([])
    return query(keys.eventsRange(familyId, childId, start, end, trackerId), async () => {
      let q = supabase
        .from('events')
        .select(withRelations ? `${EVENT_COLS}, ${TRACKER_JOIN}, ${MEMBER_JOIN}` : EVENT_COLS)
        .eq('family_id', familyId)
        .gte('occurred_at', start.toISOString())
        .lte('occurred_at', end.toISOString())
        .order('occurred_at', { ascending: false })
      if (childId) q = q.eq('child_id', childId)
      if (trackerId) q = q.eq('tracker_id', trackerId)
      return unwrap(await q) ?? []
    })
  },

  /** Whole history for one child — used by the summary page. */
  listForChild(familyId, childId, limit = 6000) {
    if (!familyId || !childId) return Promise.resolve([])
    return query(`events:${familyId}:child:${childId}:${limit}`, async () =>
      unwrap(await supabase
        .from('events')
        .select('id, tracker_id, member_id, occurred_at, data')
        .eq('family_id', familyId)
        .eq('child_id', childId)
        .order('occurred_at', { ascending: false })
        .limit(limit)) ?? []
    )
  },

  /** Most recent event for a tracker, ignoring the day window. */
  latestForTracker(familyId, trackerId, childId) {
    if (!familyId || !trackerId) return Promise.resolve(null)
    return query(`events:${familyId}:latest:${trackerId}:${childId ?? 'all'}`, async () => {
      let q = supabase
        .from('events')
        .select(EVENT_COLS)
        .eq('family_id', familyId)
        .eq('tracker_id', trackerId)
        .order('occurred_at', { ascending: false })
        .limit(1)
      if (childId) q = q.eq('child_id', childId)
      return (unwrap(await q) ?? [])[0] ?? null
    })
  },

  async create(familyId, { trackerId, memberId, childId, data, notes, occurredAt }) {
    const row = unwrap(await supabase.from('events').insert({
      family_id: familyId,
      tracker_id: trackerId,
      member_id: memberId,
      child_id: childId ?? null,
      data: data ?? {},
      notes: notes ?? null,
      occurred_at: occurredAt ?? new Date().toISOString(),
    }).select(EVENT_COLS).single())
    invalidate(keys.eventsAll(familyId))
    return row
  },

  async update(familyId, id, updates) {
    unwrap(await supabase.from('events').update(updates).eq('id', id).select('id').single())
    invalidate(keys.eventsAll(familyId))
  },

  async remove(familyId, id) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error
    invalidate(keys.eventsAll(familyId))
  },

  async removeMany(familyId, ids) {
    if (!ids?.length) return
    const { error } = await supabase.from('events').delete().in('id', ids)
    if (error) throw error
    invalidate(keys.eventsAll(familyId))
  },
}

// ── Trackers ─────────────────────────────────────────────────────────────────

export const trackers = {
  list(familyId) {
    if (!familyId) return Promise.resolve([])
    return query(keys.trackers(familyId), async () =>
      unwrap(await supabase
        .from('trackers')
        .select()
        .eq('family_id', familyId)
        .neq('is_deleted', true)
        .order('display_order')) ?? []
    )
  },

  async create(familyId, trackerData, displayOrder) {
    const { error } = await supabase.from('trackers').insert({
      ...trackerData,
      family_id: familyId,
      display_order: displayOrder,
    })
    if (error) throw error
    invalidate(keys.trackers(familyId))
  },

  async update(familyId, id, updates) {
    const { error } = await supabase.from('trackers').update(updates).eq('id', id)
    if (error) throw error
    invalidate(keys.trackers(familyId))
  },

  async softDelete(familyId, id) {
    return trackers.update(familyId, id, { is_deleted: true })
  },

  /**
   * Persist order + visibility for the whole list.
   *
   * One request per tracker was fine at five, but this is the write that runs
   * when a user drags a card, and it scales with the list. Chunked so a long
   * list can't open a dozen parallel connections.
   */
  async reorder(familyId, ordered) {
    const CHUNK = 5
    const failures = []
    for (let i = 0; i < ordered.length; i += CHUNK) {
      const slice = ordered.slice(i, i + CHUNK)
      const results = await Promise.allSettled(slice.map((tracker, offset) =>
        supabase
          .from('trackers')
          .update({
            display_order: i + offset,
            is_active: tracker._visible !== undefined ? tracker._visible : tracker.is_active,
          })
          .eq('id', tracker.id)
          .then(({ error }) => { if (error) throw error })
      ))
      failures.push(...results.filter(r => r.status === 'rejected'))
    }
    invalidate(keys.trackers(familyId))
    if (failures.length) throw new Error(`שמירת ${failures.length} מעקבים נכשלה — נסה שוב`)
  },
}

// ── Children ─────────────────────────────────────────────────────────────────

export const children = {
  list(familyId) {
    if (!familyId) return Promise.resolve([])
    return query(keys.children(familyId), async () =>
      unwrap(await supabase
        .from('children')
        .select('id, family_id, name, avatar_url, birth_date, gender, created_at')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true })) ?? []
    )
  },

  async create(familyId, { name, avatarUrl, birthDate, gender }) {
    const row = unwrap(await supabase.from('children').insert({
      family_id: familyId,
      name,
      avatar_url: avatarUrl ?? null,
      birth_date: birthDate ?? null,
      gender: gender ?? null,
    }).select().single())
    invalidate(keys.children(familyId))
    return row
  },

  async update(familyId, id, updates) {
    const { error } = await supabase.from('children').update(updates).eq('id', id)
    if (error) throw error
    invalidate(keys.children(familyId))
  },

  async remove(familyId, id) {
    const { error } = await supabase.from('children').delete().eq('id', id)
    if (error) throw error
    invalidate(keys.children(familyId))
  },
}

// ── Family members ───────────────────────────────────────────────────────────

export const members = {
  list(familyId) {
    if (!familyId) return Promise.resolve([])
    return query(keys.members(familyId), async () =>
      unwrap(await supabase
        .from('family_members')
        .select('id, family_id, display_name, role, avatar_url, auth_user_id, created_at, last_seen_at')
        .eq('family_id', familyId)
        .order('created_at')) ?? []
    )
  },

  async update(familyId, memberId, updates) {
    const { error } = await supabase.from('family_members').update(updates).eq('id', memberId)
    if (error) throw error
    invalidate(keys.members(familyId))
  },

  async remove(familyId, memberId) {
    const { error } = await supabase.from('family_members').delete().eq('id', memberId)
    if (error) throw error
    invalidate(keys.members(familyId))
  },
}

export const api = { query, invalidate, invalidateAll, keys, events, trackers, children, members }
export default api
