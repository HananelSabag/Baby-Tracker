import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMilestones(familyId, childId) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!familyId || !childId) { setLoading(false); return }
    const { data } = await supabase
      .from('milestone_photos')
      .select('*')
      .eq('family_id', familyId)
      .eq('child_id', childId)
      .order('month', { ascending: true })
    setPhotos(data ?? [])
    setLoading(false)
  }, [familyId, childId])

  useEffect(() => { fetch() }, [fetch])

  async function upsertPhoto({ month, photoUrl, caption, frameId, effectId }) {
    const { error } = await supabase
      .from('milestone_photos')
      .upsert({
        child_id:  childId,
        family_id: familyId,
        month,
        photo_url: photoUrl,
        caption:   caption ?? null,
        frame_id:  frameId ?? 'none',
        effect_id: effectId ?? 'none',
      }, { onConflict: 'child_id,month' })
    if (error) throw error
    await fetch()
  }

  async function deletePhoto(month) {
    const { error } = await supabase
      .from('milestone_photos')
      .delete()
      .eq('child_id', childId)
      .eq('month', month)
    if (error) throw error
    setPhotos(prev => prev.filter(p => p.month !== month))
  }

  const byMonth = Object.fromEntries(photos.map(p => [p.month, p]))

  return { photos, byMonth, loading, upsertPhoto, deletePhoto, refetch: fetch }
}
