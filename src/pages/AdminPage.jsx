import { useState, useEffect } from 'react'
import { t } from '../lib/strings'
import { supabase } from '../lib/supabase'
import { formatTime, formatDateLabel } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export function AdminPage() {
  const [tab, setTab] = useState('families') // 'families' | 'users'

  // ── Families tab state ──────────────────────────────────────────────────────
  const [families, setFamilies] = useState([])
  const [familiesLoading, setFamiliesLoading] = useState(true)
  const [deletingFamily, setDeletingFamily] = useState(null)
  const [expanded, setExpanded] = useState(null)

  // ── Users tab state ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersFetched, setUsersFetched] = useState(false)
  const [deletingUser, setDeletingUser] = useState(null) // { id, email }

  // ── Load families on mount ──────────────────────────────────────────────────
  useEffect(() => {
    loadFamilies()
  }, [])

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

    setFamilies(enriched)
    setFamiliesLoading(false)
  }

  async function handleDeleteFamily() {
    if (!deletingFamily) return
    await supabase.from('families').delete().eq('id', deletingFamily.id)
    setFamilies(prev => prev.filter(f => f.id !== deletingFamily.id))
    setDeletingFamily(null)
  }

  // ── Load users when tab switches ────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'users' || usersFetched) return
    loadUsers()
  }, [tab])

  async function loadUsers() {
    setUsersLoading(true)
    const { data, error } = await supabase.functions.invoke('admin-users', { method: 'GET' })
    if (!error && Array.isArray(data)) {
      // Sort newest first
      setUsers(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
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

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalMembers = families.reduce((s, f) => s + (f.family_members?.length ?? 0), 0)
  const totalEvents = families.reduce((s, f) => s + (f.events?.[0]?.count ?? 0), 0)

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-2xl">🔐</span>
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('admin.title')}</h1>
        <span className="mr-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-rubik font-medium">Admin</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card>
          <p className="text-xs text-brown-400 font-rubik">משפחות</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{families.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-brown-400 font-rubik">חברים</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{totalMembers}</p>
        </Card>
        <Card>
          <p className="text-xs text-brown-400 font-rubik">אירועים</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{totalEvents}</p>
        </Card>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-cream-200 rounded-2xl p-1 mb-5">
        <button
          onClick={() => setTab('families')}
          className={`flex-1 py-2 rounded-xl font-rubik font-medium text-sm transition-all ${tab === 'families' ? 'bg-white shadow-soft text-brown-800' : 'text-brown-500'}`}
        >
          🏠 משפחות
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex-1 py-2 rounded-xl font-rubik font-medium text-sm transition-all ${tab === 'users' ? 'bg-white shadow-soft text-brown-800' : 'text-brown-500'}`}
        >
          👤 משתמשים
        </button>
      </div>

      {/* ── Families tab ── */}
      {tab === 'families' && (
        familiesLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : families.length === 0 ? (
          <p className="text-center text-brown-400 font-rubik py-8">{t('admin.noFamilies')}</p>
        ) : (
          <div className="space-y-3">
            {families.map(fam => (
              <Card key={fam.id}>
                <div className="flex items-start justify-between mb-2">
                  <button
                    onClick={() => setExpanded(expanded === fam.id ? null : fam.id)}
                    className="flex-1 text-right"
                  >
                    <p className="font-rubik font-semibold text-brown-800">{fam.name}</p>
                    <p className="font-rubik font-bold text-lg tracking-widest text-brown-500">{fam.code}</p>
                  </button>
                  <div className="flex items-center gap-2 mr-2">
                    <p className="text-xs text-brown-300 font-rubik">{formatDateLabel(fam.created_at)}</p>
                    <button
                      onClick={() => setDeletingFamily(fam)}
                      className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors active:scale-95 text-lg"
                      title={t('admin.deleteFamily')}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-sm font-rubik text-brown-500">
                  <span>👤 {fam.family_members?.length ?? 0} {t('admin.members')}</span>
                  <span>📝 {fam.events?.[0]?.count ?? 0} {t('admin.events')}</span>
                  {fam.lastEvent && <span>🕐 {formatTime(fam.lastEvent)}</span>}
                </div>
                {expanded === fam.id && fam.family_members?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cream-200 space-y-2">
                    {fam.family_members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 text-sm font-rubik text-brown-700">
                        <span className="text-base">
                          {m.role === 'אמא' ? '👩' : m.role === 'אבא' ? '👨' :
                           m.role === 'סבא' ? '👴' : m.role === 'סבתא' ? '👵' : '👤'}
                        </span>
                        <span className="font-medium">{m.display_name}</span>
                        <span className="text-xs text-brown-400 mr-auto">{formatDateLabel(m.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (
        usersLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-brown-400 font-rubik py-8">אין משתמשים</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-brown-400 font-rubik">{users.length} משתמשים רשומים</p>
            {users.map(u => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Email */}
                    <p className="font-rubik font-semibold text-brown-800 text-sm truncate">{u.email}</p>

                    {/* Member info */}
                    {u.member ? (
                      <p className="font-rubik text-xs text-brown-500 mt-0.5">
                        {u.member.role} · {u.member.family?.name ?? '—'}
                        <span className="font-bold text-brown-400"> ({u.member.family?.code})</span>
                      </p>
                    ) : (
                      <p className="font-rubik text-xs text-red-400 mt-0.5">⚠️ ללא משפחה</p>
                    )}

                    {/* Dates */}
                    <div className="flex gap-3 mt-1">
                      <p className="font-rubik text-xs text-brown-400">
                        נרשם: {formatDateLabel(u.created_at)}
                      </p>
                      {u.last_sign_in && (
                        <p className="font-rubik text-xs text-brown-400">
                          כניסה אחרונה: {formatDateLabel(u.last_sign_in)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => setDeletingUser(u)}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors active:scale-95 flex-shrink-0"
                    title="מחק משתמש"
                  >
                    🗑
                  </button>
                </div>
              </Card>
            ))}
          </div>
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
        message={`למחוק את ${deletingUser?.email}?\n\nאם הוא היחיד במשפחה — המשפחה תימחק גם כן.`}
        onConfirm={handleDeleteUser}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  )
}
