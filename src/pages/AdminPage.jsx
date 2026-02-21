import { useState, useEffect } from 'react'
import { t } from '../lib/strings'
import { supabase } from '../lib/supabase'
import { formatTime, formatDateLabel } from '../lib/utils'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'

export function AdminPage() {
  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Load all families with member and event counts
    const { data: fams } = await supabase
      .from('families')
      .select('*, family_members(count), events(count)')
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

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🔐</span>
        <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('admin.title')}</h1>
        <span className="mr-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-rubik font-medium">Admin</span>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card>
          <p className="text-xs text-brown-400 font-rubik">משפחות</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">{families.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-brown-400 font-rubik">חברים סה"כ</p>
          <p className="font-rubik font-bold text-3xl text-brown-800">
            {families.reduce((s, f) => s + (f.family_members?.[0]?.count ?? 0), 0)}
          </p>
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
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-rubik font-semibold text-brown-800">{fam.name}</p>
                  <p className="font-rubik font-bold text-lg tracking-widest text-brown-500">{fam.code}</p>
                </div>
                <p className="text-xs text-brown-300 font-rubik">{formatDateLabel(fam.created_at)}</p>
              </div>
              <div className="flex gap-4 text-sm font-rubik text-brown-500">
                <span>👤 {fam.family_members?.[0]?.count ?? 0} {t('admin.members')}</span>
                <span>📝 {fam.events?.[0]?.count ?? 0} {t('admin.events')}</span>
                {fam.lastEvent && <span>🕐 {formatTime(fam.lastEvent)}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
