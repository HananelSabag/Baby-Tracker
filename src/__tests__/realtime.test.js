import { describe, it, expect, beforeEach, vi } from 'vitest'

// Fake Supabase channel that records its postgres_changes handlers so a test
// can push a payload through exactly the way the server would.
const created = []
const removed = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel(name) {
      const handlers = []
      const ch = {
        name,
        handlers,
        on(_evt, cfg, fn) { handlers.push({ cfg, fn }); return ch },
        subscribe() { return ch },
        emit(table, payload) {
          handlers.filter(h => h.cfg.table === table).forEach(h => h.fn(payload))
        },
      }
      created.push(ch)
      return ch
    },
    removeChannel(ch) { removed.push(ch) },
  },
}))

const { subscribeToTable, openChannelCount, __resetRealtime } = await import('../lib/realtime')

beforeEach(() => {
  // Reset FIRST: tearing down channels left open by the previous test calls
  // removeChannel, and those calls would otherwise land in the freshly
  // cleared arrays and be read as this test's activity.
  __resetRealtime()
  created.length = 0
  removed.length = 0
})

describe('shared family channel', () => {
  it('opens ONE channel no matter how many hooks subscribe', () => {
    // The home page previously held ~9 channels; every one received every row.
    const offs = [
      subscribeToTable('fam1', 'events', () => {}),
      subscribeToTable('fam1', 'events', () => {}),
      subscribeToTable('fam1', 'events', () => {}),
      subscribeToTable('fam1', 'trackers', () => {}),
      subscribeToTable('fam1', 'children', () => {}),
    ]
    expect(created.length).toBe(1)
    expect(openChannelCount()).toBe(1)
    offs.forEach(off => off())
  })

  it('keeps separate families on separate channels', () => {
    subscribeToTable('fam1', 'events', () => {})
    subscribeToTable('fam2', 'events', () => {})
    expect(openChannelCount()).toBe(2)
  })

  it('fans a row out to every listener on that table', () => {
    const a = vi.fn(), b = vi.fn()
    subscribeToTable('fam1', 'events', a)
    subscribeToTable('fam1', 'events', b)

    created[0].emit('events', { new: { tracker_id: 't1' } })

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('does not deliver a row to listeners on a different table', () => {
    const onEvents = vi.fn(), onTrackers = vi.fn()
    subscribeToTable('fam1', 'events', onEvents)
    subscribeToTable('fam1', 'trackers', onTrackers)

    created[0].emit('events', { new: {} })

    expect(onEvents).toHaveBeenCalledTimes(1)
    expect(onTrackers).not.toHaveBeenCalled()
  })

  it('one throwing listener does not stop the others', () => {
    const good = vi.fn()
    subscribeToTable('fam1', 'events', () => { throw new Error('boom') })
    subscribeToTable('fam1', 'events', good)

    expect(() => created[0].emit('events', { new: {} })).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
  })
})

describe('ref counting', () => {
  it('holds the channel open while any subscriber remains', () => {
    const off1 = subscribeToTable('fam1', 'events', () => {})
    const off2 = subscribeToTable('fam1', 'trackers', () => {})

    off1()
    expect(openChannelCount()).toBe(1)
    expect(removed.length).toBe(0)

    off2()
    expect(openChannelCount()).toBe(0)
    expect(removed.length).toBe(1)
  })

  it('stops delivering to a listener after it unsubscribes', () => {
    const fn = vi.fn()
    const off = subscribeToTable('fam1', 'events', fn)
    subscribeToTable('fam1', 'events', () => {})   // keep the channel alive

    off()
    created[0].emit('events', { new: {} })
    expect(fn).not.toHaveBeenCalled()
  })

  it('is safe to unsubscribe twice — StrictMode double-invokes cleanup', () => {
    const off1 = subscribeToTable('fam1', 'events', () => {})
    const off2 = subscribeToTable('fam1', 'events', () => {})

    off1()
    off1()   // second call must be a no-op, not another decrement

    expect(openChannelCount()).toBe(1)
    off2()
    expect(openChannelCount()).toBe(0)
  })

  it('ignores an unknown table instead of opening a channel for it', () => {
    const off = subscribeToTable('fam1', 'not_a_table', () => {})
    expect(openChannelCount()).toBe(0)
    expect(() => off()).not.toThrow()
  })

  it('ignores a missing familyId', () => {
    subscribeToTable(null, 'events', () => {})
    expect(openChannelCount()).toBe(0)
  })
})
