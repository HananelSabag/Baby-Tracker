import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Trash2, Users, User, ChevronLeft, ChevronRight, ChevronDown,
  AlertTriangle, Activity, Zap, Search, RefreshCw, Baby, ClipboardList,
  Copy, Check, Ghost, Loader2,
} from 'lucide-react'
import { goBack } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { useAdminData, bestLastSeen, daysSince, isDormant } from '../hooks/useAdminData'

const ROLE_EMOJI = { 'אמא': '👩', 'אבא': '👨', 'סבא': '👴', 'סבתא': '👵' }

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
  if (d < 7)   return `${d} ימים`
  const w = Math.floor(d / 7)
  if (d < 30)  return w === 1 ? 'שבוע' : `${w} שבועות`
  const mo = Math.floor(d / 30)
  if (d < 365) return mo === 1 ? 'חודש' : `${mo} חודשים`
  const yr = Math.floor(d / 365)
  return yr === 1 ? 'שנה' : `${yr} שנים`
}

function shortDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

function activityDot(dateStr) {
  const days = daysSince(dateStr)
  if (days === Infinity) return 'bg-cream-300'
  if (days < 7)  return 'bg-green-400'
  if (days < 30) return 'bg-amber-400'
  return 'bg-red-300'
}

function activityTextClass(dateStr) {
  const days = daysSince(dateStr)
  if (days === Infinity) return 'text-brown-300'
  if (days < 7)  return 'text-green-600'
  if (days < 30) return 'text-amber-600'
  return 'text-red-400'
}

// ═══════════════════════════════════════════════════════════════════════════
export function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const { users, families, loading, error, refresh, deleteUser, deleteFamily } = useAdminData()
  const { toasts, showToast, dismissToast } = useToast()

  const [deletingUser, setDeletingUser] = useState(null)
  const [deletingFamily, setDeletingFamily] = useState(null)
  const [busy, setBusy] = useState(false)

  const totals = useMemo(() => ({
    users: users.length,
    families: families.length,
    withoutFamily: users.filter(u => !u.member).length,
    dormant: users.filter(isDormant).length,
    activeWeek: users.filter(u => daysSince(bestLastSeen(u)) < 7).length,
    events: families.reduce((s, f) => s + (f.eventCount ?? 0), 0),
  }), [users, families])

  async function handleDeleteUser() {
    if (!deletingUser) return
    setBusy(true)
    try {
      const res = await deleteUser(deletingUser.id)
      showToast({
        message: res?.deletedFamily ? 'המשתמש והמשפחה נמחקו' : 'המשתמש נמחק',
        emoji: '🗑',
      })
      setDeletingUser(null)
    } catch (e) {
      showToast({ message: e.message, emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteFamily() {
    if (!deletingFamily) return
    setBusy(true)
    try {
      await deleteFamily(deletingFamily.id)
      showToast({ message: 'המשפחה נמחקה', emoji: '🗑' })
      setDeletingFamily(null)
    } catch (e) {
      showToast({ message: e.message ?? 'המחיקה נכשלה', emoji: '⚠️' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 pt-8 pb-10" dir="rtl">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => goBack(navigate, '/profile')}
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brown-600 cursor-pointer active:scale-95 transition-transform flex-shrink-0 border border-cream-200"
          style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          aria-label="חזור"
        >
          <ChevronRight size={20} />
        </button>
        <div
          className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100 flex-shrink-0"
          style={{ boxShadow: '0 2px 8px rgba(239,68,68,0.12)' }}
        >
          <ShieldCheck size={22} className="text-red-500" />
        </div>
        <h1 className="font-rubik font-bold text-2xl text-brown-800 leading-tight flex-1">ניהול</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brown-600 cursor-pointer active:scale-95 transition-transform border border-cream-200 disabled:opacity-40"
          style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.08)' }}
          aria-label="רענן"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
        </button>
      </div>

      {/* Failures are shown, never swallowed */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 mb-5 flex items-start gap-3">
          <AlertTriangle size={17} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-rubik font-bold text-red-700 text-sm">טעינת הנתונים נכשלה</p>
            <p className="font-rubik text-red-600 text-xs mt-1 leading-relaxed break-words">{error}</p>
            <button
              onClick={refresh}
              className="mt-2.5 font-rubik font-bold text-xs text-white bg-red-500 px-3.5 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform"
            >
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <StatTile icon={<User size={11} className="text-brown-400" />} label="משתמשים" value={totals.users} />
        <StatTile icon={<Users size={11} className="text-brown-400" />} label="משפחות" value={totals.families} />
        <StatTile icon={<Activity size={11} className="text-green-500" />} label="פעילים" value={totals.activeWeek} valueClass="text-green-600" />
        <StatTile icon={<Ghost size={11} className="text-red-400" />} label="רדומים" value={totals.dormant} valueClass="text-red-500" />
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1.5 bg-cream-100 rounded-2xl p-1.5 mb-5 border border-cream-200"
        style={{ boxShadow: 'inset 0 1px 3px rgba(61,43,31,0.06)' }}
      >
        {[
          { key: 'users', label: `משתמשים (${users.length})` },
          { key: 'families', label: `משפחות (${families.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 rounded-xl font-rubik font-bold text-sm transition-all duration-200 cursor-pointer ${
              tab === t.key ? 'bg-white text-brown-800' : 'text-brown-400'
            }`}
            style={tab === t.key ? { boxShadow: '0 2px 8px rgba(61,43,31,0.10), inset 0 1px 0 rgba(255,255,255,0.9)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><Spinner size="lg" /></div>
      ) : tab === 'users' ? (
        <UsersTab users={users} onDelete={setDeletingUser} showToast={showToast} />
      ) : (
        <FamiliesTab families={families} onDelete={setDeletingFamily} showToast={showToast} />
      )}

      <ConfirmDialog
        isOpen={Boolean(deletingUser)}
        message={
          deletingUser
            ? `למחוק את ${deletingUser.email}?\n\nהאירועים שהוא רשם יישארו במשפחה. אם זה החבר האחרון — כל המשפחה תימחק.`
            : ''
        }
        onConfirm={handleDeleteUser}
        onCancel={() => !busy && setDeletingUser(null)}
      />
      <ConfirmDialog
        isOpen={Boolean(deletingFamily)}
        message={deletingFamily ? `למחוק את משפחת ${deletingFamily.name} וכל הנתונים שלה?` : ''}
        onConfirm={handleDeleteFamily}
        onCancel={() => !busy && setDeletingFamily(null)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════

const USER_FILTERS = [
  { key: 'all',      label: 'הכל' },
  { key: 'active',   label: 'פעילים' },
  { key: 'dormant',  label: 'רדומים' },
  { key: 'nofamily', label: 'ללא משפחה' },
]

function UsersTab({ users, onDelete, showToast }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter(u => {
        if (filter === 'active')   return daysSince(bestLastSeen(u)) < 7
        if (filter === 'dormant')  return isDormant(u)
        if (filter === 'nofamily') return !u.member
        return true
      })
      .filter(u => {
        if (!q) return true
        return [u.email, u.full_name, u.member?.display_name, u.member?.family?.name, u.member?.family?.code]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => {
        const at = bestLastSeen(a) ? new Date(bestLastSeen(a)).getTime() : 0
        const bt = bestLastSeen(b) ? new Date(bestLastSeen(b)).getTime() : 0
        return bt - at
      })
  }, [users, filter, search])

  return (
    <>
      {/* Search */}
      <div
        className="flex items-center gap-2.5 bg-white rounded-2xl px-4 py-3 mb-3 border border-cream-200"
        style={{ boxShadow: '0 2px 10px rgba(61,43,31,0.06)' }}
      >
        <Search size={15} className="text-brown-400 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חפש מייל, שם או קוד משפחה"
          className="flex-1 bg-transparent outline-none font-rubik text-sm text-brown-800 min-w-0"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-brown-300 font-rubik text-lg leading-none cursor-pointer">×</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-0.5">
        {USER_FILTERS.map(f => (
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-brown-400 font-rubik py-10 text-sm">אין תוצאות</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(u => (
            <UserRow
              key={u.id}
              user={u}
              expanded={expanded === u.id}
              onToggle={() => setExpanded(expanded === u.id ? null : u.id)}
              onDelete={() => onDelete(u)}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </>
  )
}

function UserRow({ user, expanded, onToggle, onDelete, showToast }) {
  const lastSeen = bestLastSeen(user)
  const dormant = isDormant(user)
  const events = user.stats?.events ?? 0

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-cream-200"
      style={{ boxShadow: '0 3px 14px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.95)' }}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 flex items-center justify-center font-rubik font-bold text-brown-600">
            {user.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : (user.email?.[0] ?? '?').toUpperCase()
            }
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${activityDot(lastSeen)}`} />
        </div>

        <button onClick={onToggle} className="flex-1 min-w-0 text-right cursor-pointer">
          <p className="font-rubik font-bold text-brown-800 text-sm leading-tight truncate">
            {user.full_name || user.member?.display_name || 'ללא שם'}
          </p>
          <p className="font-rubik text-brown-400 text-xs truncate mt-0.5">{user.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {user.member ? (
              <span className="font-rubik text-[11px] text-brown-500">
                {ROLE_EMOJI[user.member.role] ?? '👤'} {user.member.role} · {user.member.family?.name ?? '—'}
              </span>
            ) : (
              <span className="font-rubik text-[11px] font-bold text-red-500">ללא משפחה</span>
            )}
            {dormant && (
              <span className="font-rubik text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md">
                רדום
              </span>
            )}
            <span className={`font-rubik text-[11px] ${activityTextClass(lastSeen)}`}>
              {lastSeen ? `לפני ${timeAgo(lastSeen)}` : 'מעולם לא נכנס'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="font-rubik text-[11px] text-brown-400 bg-cream-100 border border-cream-200 px-2 py-1 rounded-lg">
            {events} ✍️
          </span>
          <button
            onClick={onDelete}
            className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-400 cursor-pointer active:scale-95 transition-transform border border-red-100"
            aria-label="מחק משתמש"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-cream-100 space-y-1.5">
          <DetailRow label="מייל" value={user.email} copyable showToast={showToast} />
          <DetailRow label="נרשם" value={`${shortDate(user.created_at)} · לפני ${timeAgo(user.created_at)}`} />
          <DetailRow label="כניסה אחרונה" value={lastSeen ? `${shortDate(lastSeen)} · לפני ${timeAgo(lastSeen)}` : 'מעולם'} />
          <DetailRow label="שיטת כניסה" value={(user.providers ?? []).join(', ') || '—'} />
          <DetailRow label="דיווחים שרשם" value={String(events)} />
          {user.member?.family && (
            <>
              <DetailRow label="משפחה" value={`${user.member.family.name} · ${user.member.family.code}`} copyable copyValue={user.member.family.code} showToast={showToast} />
              <DetailRow label="במשפחה" value={`${user.stats.family_members} חברים · ${user.stats.family_children} ילדים · ${user.stats.family_events} דיווחים`} />
            </>
          )}
          <DetailRow label="מזהה" value={user.id} copyable showToast={showToast} mono />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FAMILIES
// ═══════════════════════════════════════════════════════════════════════════

function FamiliesTab({ families, onDelete, showToast }) {
  const [sort, setSort] = useState('activity')
  const [expanded, setExpanded] = useState(null)

  const sorted = useMemo(() => {
    const copy = [...families]
    if (sort === 'date') return copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'size') return copy.sort((a, b) => b.eventCount - a.eventCount)
    return copy.sort((a, b) => {
      const at = a.lastEvent ? new Date(a.lastEvent).getTime() : 0
      const bt = b.lastEvent ? new Date(b.lastEvent).getTime() : 0
      return bt - at
    })
  }, [families, sort])

  return (
    <>
      <div className="flex gap-2 mb-4">
        {[
          { key: 'activity', label: 'פעילות', Icon: Zap },
          { key: 'size', label: 'נפח', Icon: ClipboardList },
          { key: 'date', label: 'תאריך', Icon: Activity },
        ].map(({ key, label, Icon }) => (
          <FilterChip key={key} active={sort === key} onClick={() => setSort(key)}>
            <Icon size={12} />
            {label}
          </FilterChip>
        ))}
      </div>

      <div className="space-y-2.5">
        {sorted.map(fam => (
          <Card key={fam.id} compact>
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activityDot(fam.lastEvent)}`} />
              <button
                onClick={() => setExpanded(expanded === fam.id ? null : fam.id)}
                className="flex-1 text-right min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <p className="font-rubik font-bold text-brown-800 text-sm leading-tight truncate">{fam.name}</p>
                  {fam.orphan && (
                    <span className="font-rubik text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      ריקה
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                  <span className="font-rubik text-xs text-brown-400 tracking-widest">{fam.code}</span>
                  <span className="flex items-center gap-1 font-rubik text-xs text-brown-400">
                    <Users size={10} />{fam.memberCount}
                  </span>
                  <span className="flex items-center gap-1 font-rubik text-xs text-brown-400">
                    <Baby size={10} />{fam.childCount}
                  </span>
                  <span className="flex items-center gap-1 font-rubik text-xs text-brown-400">
                    <ClipboardList size={10} />{fam.eventCount}
                  </span>
                  <span className={`font-rubik text-xs ${activityTextClass(fam.lastEvent)}`}>
                    {fam.lastEvent ? `לפני ${timeAgo(fam.lastEvent)}` : 'ללא פעילות'}
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <ChevronDown
                  size={15}
                  className={`text-brown-300 transition-transform ${expanded === fam.id ? 'rotate-180' : ''}`}
                />
                <button
                  onClick={() => onDelete(fam)}
                  className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-400 cursor-pointer active:scale-95 transition-transform border border-red-100"
                  aria-label="מחק משפחה"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {expanded === fam.id && (
              <div className="mt-3 pt-3 border-t border-cream-100 space-y-1.5">
                <DetailRow label="נוצרה" value={`${shortDate(fam.created_at)} · לפני ${timeAgo(fam.created_at)}`} />
                <DetailRow label="קוד הצטרפות" value={fam.code} copyable showToast={showToast} />
                {fam.members.length === 0 ? (
                  <p className="font-rubik text-xs text-brown-300 pt-1">אין חברים במשפחה הזו</p>
                ) : (
                  <div className="pt-1 space-y-1">
                    {fam.members.map(m => (
                      <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-cream-50">
                        <span className="text-base flex-shrink-0">{ROLE_EMOJI[m.member?.role] ?? '👤'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-rubik font-semibold text-xs text-brown-800 leading-tight">
                            {m.member?.display_name ?? '—'}
                          </p>
                          <p className="font-rubik text-[11px] text-brown-400 truncate">{m.email}</p>
                        </div>
                        <span className="font-rubik text-[11px] text-brown-400 flex-shrink-0">
                          {m.stats?.events ?? 0} ✍️
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared
// ═══════════════════════════════════════════════════════════════════════════

function StatTile({ icon, label, value, valueClass = 'text-brown-800' }) {
  return (
    <Card compact>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <p className="text-[10px] text-brown-400 font-rubik leading-tight truncate">{label}</p>
      </div>
      <p className={`font-rubik font-bold text-2xl ${valueClass}`}>{value}</p>
    </Card>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-rubik text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 border min-h-[36px] ${
        active ? 'bg-brown-800 text-white border-brown-900/20' : 'bg-cream-100 text-brown-600 border-cream-200'
      }`}
      style={active ? { boxShadow: '0 3px 8px rgba(61,43,31,0.20)' } : {}}
    >
      {children}
    </button>
  )
}

function DetailRow({ label, value, copyable, copyValue, showToast, mono }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  function copy() {
    const text = copyValue ?? value
    navigator.clipboard?.writeText(text)
    setCopied(true)
    showToast?.({ message: 'הועתק', emoji: '📋' })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-rubik text-brown-400 w-24 flex-shrink-0">{label}</span>
      <span className={`font-rubik text-brown-700 flex-1 min-w-0 truncate ${mono ? 'font-mono text-[10px]' : ''}`}>
        {value}
      </span>
      {copyable && (
        <button
          onClick={copy}
          className="w-7 h-7 rounded-lg bg-cream-100 border border-cream-200 flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
          aria-label={`העתק ${label}`}
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-brown-400" />}
        </button>
      )}
    </div>
  )
}
