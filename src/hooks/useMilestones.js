import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { query, invalidate } from '../lib/api'

// Milestone photos deliberately do NOT join the shared realtime channel: the
// album isn't a live-collaboration surface, so a subscription would cost a
// listener for nothing. Reads still go through the shared request layer so
// remounting the page (or two components asking at once) doesn't refetch.

const cacheKey = (familyId, childId) => `milestones:${familyId}:${childId}`

export function useMilestones(familyId, childId) {
  const [photos, setPhotos] = useState(EMPTY)
  const [loading, setLoading] = useState(Boolean(familyId && childId))

  const load = useCallback(async ({ force = false } = {}) => {
    if (!familyId || !childId) {
      setPhotos(EMPTY)
      setLoading(false)
      return
    }
    const key = cacheKey(familyId, childId)
    if (force) invalidate(key)
    try {
      const rows = await query(key, async () => {
        const { data, error } = await supabase
          .from('milestone_photos')
          .select('id, child_id, family_id, month, photo_url, caption, frame_id, effect_id, photo_date, created_at')
          .eq('family_id', familyId)
          .eq('child_id', childId)
          .order('month', { ascending: true })
        if (error) throw error
        return data ?? []
      })
      setPhotos(rows)
    } catch {
      setPhotos(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [familyId, childId])

  useEffect(() => { load() }, [load])

  const refetch = useCallback(() => load({ force: true }), [load])

  async function upsertPhoto({ month, photoUrl, caption, frameId, effectId, photoDate }) {
    const { error } = await supabase
      .from('milestone_photos')
      .upsert({
        child_id:   childId,
        family_id:  familyId,
        month,
        photo_url:  photoUrl,
        caption:    caption ?? null,
        frame_id:   frameId ?? 'none',
        effect_id:  effectId ?? 'none',
        // Empty string → null so clearing the field falls back to EXIF/upload date.
        photo_date: photoDate || null,
      }, { onConflict: 'child_id,month' })
    if (error) throw error
    await refetch()
  }

  async function deletePhoto(month) {
    const { error } = await supabase
      .from('milestone_photos')
      .delete()
      .eq('child_id', childId)
      .eq('month', month)
    if (error) throw error
    // Refetch rather than filtering locally — the local-only version left the
    // cached copy stale, so reopening the album brought the photo back.
    await refetch()
  }

  const byMonth = useMemo(
    () => Object.fromEntries(photos.map(p => [p.month, p])),
    [photos]
  )

  return { photos, byMonth, loading, upsertPhoto, deletePhoto, refetch }
}

const EMPTY = []
