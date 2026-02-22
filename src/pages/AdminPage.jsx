import { useState, useEffect } from 'react'
import { t } from '../lib/strings'
import { supabase } from '../lib/supabase'
import { formatTime, formatDateLabel } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export function AdminPage() {
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingFamily, setDeletingFamily] = useState(null) // { id, name }
  const [expanded, setExpanded] = useState(null) // family id

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Load all families with member list and event count
    const { data: fams } = await supabase
      .from('families')
      .select('*, family_members(*), events(count)')
      .order('created_at', { ascending: false })

    // Load last event per family
    const enriched = await Promise.all((fams ?? []).map(async fam => {
      const { data: lastEvent } = await supabase
        .from('events')
        .select('occurred_at')
        .eq('family_id', fam.id)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .single()
      return { ...fam, lastEvent: lastEvent?.occurred_at ?? null }
    }))

    setFamilies(enriched)
    setLoading(false)
  }

  async function handleDeleteFamily() {
    if (!deletingFamily) return
    await supabase.from('families').delete().eq('id', deletingFamily.id)
    setFamilies(prev => prev.filter(f => f.id !== deletingFamily.id))
    setDeletingFamily(null)
  }

  const totalMembers = families.reduce((s, f) => s + (f.family_members?.length ?? 0), 0)
  const totalEvents = families.reduce((s, f) => s + (f.events?.[0]?.count ?? 0), 0)

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🔐</span>
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('admin.title')}</h1>
        <span className="mr-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-rubik font-medium">Admin</span>
      </div>

      {/* Stats summary */}
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

      {/* Families list */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : families.length === 0 ? (
        <p className="text-center text-brown-400 font-rubik py-8">{t('admin.noFamilies')}</p>
      ) : (
        <div className="space-y-3">
          {families.map(fam => (
            <Card key={fam.id}>
              {/* Header row */}
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

              {/* Stats row */}
              <div className="flex gap-4 text-sm font-rubik text-brown-500">
                <span>👤 {fam.family_members?.length ?? 0} {t('admin.members')}</span>
                <span>📝 {fam.events?.[0]?.count ?? 0} {t('admin.events')}</span>
                {fam.lastEvent && <span>🕐 {formatTime(fam.lastEvent)}</span>}
              </div>

              {/* Expanded: member list */}
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
      )}

      <ConfirmDialog
        isOpen={!!deletingFamily}
        message={t('admin.deleteFamilyConfirm').replace('{{name}}', deletingFamily?.name ?? '')}
        onConfirm={handleDeleteFamily}
        onCancel={() => setDeletingFamily(null)}
      />
    </div>
  )
}
