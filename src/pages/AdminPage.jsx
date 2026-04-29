import { useState, useEffect } from 'react'
import { t } from '../lib/strings'
import { supabase } from '../lib/supabase'
import { formatDateLabel } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

function timeAgo(dateStr) {
  if (!dateStr) return 'מעולם'
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'כרגע'
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} דק׳`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} שע׳`
  const d = Math.floor(h / 24)
  if (d === 1) return 'אתמול'
  if (d < 7) return `${d} ימים`
  if (d < 30) return `${Math.floor(d / 7)} שבועות`
  if (d < 365) return `${Math.floor(d / 30)} חודשים`
  return `${Math.floor(d / 365)} שנים`
}

function activityDot(dateStr) {
  if (!dateStr) return 'bg-cream-300'
  const days = (Date.now() - new Date(dateStr)) / 86_400_000
  if (days < 7)  return 'bg-green-400'
  if (days < 30) return 'bg-amber-400'
  return 'bg-red-300'
}

function activityTextClass(dateStr) {
  if (!dateStr) return 'text-brown-300'
  const days = (Date.now() - new Date(dateStr)) / 86_400_000
  if (days < 7)  return 'text-green-600'
  if (days < 30) return 'text-amber-600'
  return 'text-red-400'
}

const ROLE_EMOJI = { 'אמא': '👩', 'אבא': '👨', 'סבא': '👴', 'סבתא': '👵' }

export function AdminPage() {
  const [tab, setTab] = useState('families')

  // ── Families ────────────────────────────────────────────────────────────────
  const [families, setFamilies] = useState([])
  const [familiesLoading, setFamiliesLoading] = useState(true)
  const [deletingFamily, setDeletingFamily] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [famSort, setFamSort] = useState('activity') // 'activity' | 'date'

  // ── Users ───────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersFetched, setUsersFetched] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null)
  const [userFilter, setUserFilter] = useState('all') // 'all' | 'active' | 'no-family'

  useEffect(() => { loadFamilies() }, [])

  async function loadFamilies() {
    setFamiliesLoading(true)
    const { data: fams } = await supabase
      .from('families')
      .select('*, family_members(*), events(count)')
      .order('created_at', { ascending: false })

    const enriched = await Promise.all((fams ?? []).map(async fam => {
      const { data: lastEvent } = await supabase
        .from('events')
        .select('occurred_at')
        .eq('family_id', fam.id)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return { ...fam, lastEvent: lastEvent?.occurred_at ?? null }
    }))

    // Default sort: most recently active first
    enriched.sort((a, b) => {
      const at = a.lastEvent ? new Date(a.lastEvent).getTime() : 0
      const bt = b.lastEvent ? new Date(b.lastEvent).getTime() : 0
      return bt - at
    })

    setFamilies(enriched)
    setFamiliesLoading(false)
  }

  async function handleDeleteFamily() {
    if (!deletingFamily) return
    await supabase.from('families').delete().eq('id', deletingFamily.id)
    setFamilies(prev => prev.filter(f => f.id !== deletingFamily.id))
    setDeletingFamily(null)
  }

  useEffect(() => {
    if (tab !== 'users' || usersFetched) return
    loadUsers()
  }, [tab])

  async function loadUsers() {
    setUsersLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-users', { method: 'GET' })
    if (!error && Array.isArray(data)) {
      // Sort by most recently active (last_sign_in) first
      data.sort((a, b) => {
        const at = a.last_sign_in ? new Date(a.last_sign_in).getTime() : 0
        const bt = b.last_sign_in ? new Date(b.last_sign_in).getTime() : 0
        return bt - at
      })
      setUsers(data)
      setUsersFetched(true)
    }
    setUsersLoading(false)
  }

  async function handleDeleteUser() {
    if (!deletingUser) return
    const { error } = await supabase.functions.invoke('admin-users', {
      method: 'DELETE',
      body: { userId: deletingUser.id },
    })
    if (!error) setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
    setDeletingUser(null)
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalMembers = families.reduce((s, f) => s + (f.family_members?.length ?? 0), 0)
  const activeThisWeek = families.filter(f => {
    if (!f.lastEvent) return false
    return (Date.now() - new Date(f.lastEvent)) / 86_400_000 < 7
  }).length

  // Sorted families for display
  const sortedFamilies = famSort === 'date'
    ? [...families].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : families // already sorted by activity from load

  // Filtered users
  const filteredUsers = users.filter(u => {
    if (userFilter === 'active') {
      return u.last_sign_in && (Date.now() - new Date(u.last_sign_in)) / 86_400_000 < 7
    }
    if (userFilter === 'no-family') return !u.member
    return true
  })

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-2xl">🔐</span>
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('admin.title')}</h1>
        <span className="mr-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-rubik font-medium">Admin</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card>
          <p className="text-[11px] text-brown-400 font-rubik leading-tight">{t('admin.families')}</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{families.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] text-brown-400 font-rubik leading-tight">{t('admin.members')}</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{totalMembers}</p>
        </Card>
        <Card>
          <p className="text-[11px] text-brown-400 font-rubik leading-tight">פעיל השבוע</p>
          <p className="font-rubik font-bold text-3xl text-green-600">{activeThisWeek}</p>
        </Card>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-cream-200 rounded-2xl p-1 mb-5">
        <button
          onClick={() => setTab('families')}
          className={`flex-1 py-2 rounded-xl font-rubik font-medium text-sm transition-all ${tab === 'families' ? 'bg-white shadow-soft text-brown-800' : 'text-brown-500'}`}
        >
          {t('admin.familiesTab')}
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex-1 py-2 rounded-xl font-rubik font-medium text-sm transition-all ${tab === 'users' ? 'bg-white shadow-soft text-brown-800' : 'text-brown-500'}`}
        >
          {t('admin.usersTab')}
          {users.length > 0 && (
            <span className="mr-1 text-[10px] bg-brown-200 text-brown-600 px-1.5 py-0.5 rounded-full font-medium">{users.length}</span>
          )}
        </button>
      </div>

      {/* ── Families tab ── */}
      {tab === 'families' && (
        familiesLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : families.length === 0 ? (
          <p className="text-center text-brown-400 font-rubik py-8">{t('admin.noFamilies')}</p>
        ) : (
          <>
            {/* Sort chips */}
            <div className="flex gap-2 mb-3">
              {[{ key: 'activity', label: '⚡ לפי פעילות' }, { key: 'date', label: '📅 לפי תאריך' }].map(s => (
                <button
                  key={s.key}
                  onClick={() => setFamSort(s.key)}
                  className={`px-3 py-1.5 rounded-full font-rubik text-xs font-medium transition-all ${
                    famSort === s.key ? 'bg-brown-800 text-white' : 'bg-cream-200 text-brown-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {sortedFamilies.map(fam => (
                <Card key={fam.id} compact>
                  <div className="flex items-center gap-3">
                    {/* Activity dot */}
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activityDot(fam.lastEvent)}`} />

                    {/* Main info — tappable to expand */}
                    <button
                      onClick={() => setExpanded(expanded === fam.id ? null : fam.id)}
                      className="flex-1 text-right min-w-0"
                    >
                      <p className="font-rubik font-semibold text-brown-800 text-sm leading-tight">{fam.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-rubik text-xs text-brown-400 tracking-widest">{fam.code}</span>
                        <span className="font-rubik text-xs text-brown-400">
                          👤 {fam.family_members?.length ?? 0}
                        </span>
                        {fam.lastEvent && (
                          <span className={`font-rubik text-xs ${activityTextClass(fam.lastEvent)}`}>
                            {timeAgo(fam.lastEvent)} לפני
                          </span>
                        )}
                        {!fam.lastEvent && (
                          <span className="font-rubik text-xs text-brown-300">ללא פעילות</span>
                        )}
                      </div>
                    </button>

                    {/* Created date + delete */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-[10px] text-brown-300 font-rubik">{formatDateLabel(fam.created_at)}</p>
                      <button
                        onClick={() => setDeletingFamily(fam)}
                        className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:scale-95 active:bg-red-100 transition-all text-sm"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Expanded members */}
                  {expanded === fam.id && fam.family_members?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-cream-100 space-y-1.5">
                      {fam.family_members.map(m => (
                        <div key={m.id} className="flex items-center gap-2 text-sm font-rubik text-brown-600">
                          <span className="text-base">{ROLE_EMOJI[m.role] ?? '👤'}</span>
                          <span className="font-medium text-sm">{m.display_name}</span>
                          <span className="text-xs text-brown-300 mr-auto">{formatDateLabel(m.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </>
        )
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (
        usersLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-brown-400 font-rubik py-8">{t('admin.noUsers')}</p>
        ) : (
          <>
            {/* Filter chips */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5">
              {[
                { key: 'all', label: `הכל (${users.length})` },
                { key: 'active', label: '🟢 פעיל 7 ימים' },
                { key: 'no-family', label: '⚠️ ללא משפחה' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setUserFilter(f.key)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full font-rubik text-xs font-medium transition-all ${
                    userFilter === f.key ? 'bg-brown-800 text-white' : 'bg-cream-200 text-brown-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Compact list */}
            {filteredUsers.length === 0 ? (
              <p className="text-center text-brown-400 font-rubik py-6 text-sm">אין תוצאות לסינון זה</p>
            ) : (
              <div className="bg-white rounded-3xl shadow-card overflow-hidden divide-y divide-cream-100">
                {filteredUsers.map(u => {
                  const initial = (u.email?.[0] ?? '?').toUpperCase()
                  const dot = activityDot(u.last_sign_in)
                  const timeClass = activityTextClass(u.last_sign_in)
                  const ago = timeAgo(u.last_sign_in)

                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Avatar with activity dot */}
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-cream-200 flex items-center justify-center font-rubik font-bold text-brown-600 text-sm">
                          {initial}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${dot}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {u.member ? (
                          <p className="font-rubik text-brown-800 text-sm font-semibold leading-tight truncate">
                            {ROLE_EMOJI[u.member.role] ?? '👤'} {u.member.role} · {u.member.family?.name ?? '—'}
                          </p>
                        ) : (
                          <p className="font-rubik text-red-500 text-sm font-semibold leading-tight">⚠️ ללא משפחה</p>
                        )}
                        <p className="font-rubik text-brown-300 text-xs truncate mt-0.5">{u.email}</p>
                        <p className={`font-rubik text-[11px] mt-0.5 ${timeClass}`}>
                          {u.last_sign_in ? `נכנס לפני ${ago}` : 'מעולם לא נכנס'}
                        </p>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => setDeletingUser(u)}
                        className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 active:scale-95 active:bg-red-100 transition-all flex-shrink-0 text-sm"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      )}

      {/* Confirm: delete family */}
      <ConfirmDialog
        isOpen={!!deletingFamily}
        message={t('admin.deleteFamilyConfirm').replace('{{name}}', deletingFamily?.name ?? '')}
        onConfirm={handleDeleteFamily}
        onCancel={() => setDeletingFamily(null)}
      />

      {/* Confirm: delete user */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        message={t('admin.deleteUserConfirm', { email: deletingUser?.email ?? '' })}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  )
}
