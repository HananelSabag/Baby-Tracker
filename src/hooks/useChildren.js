import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Standalone function — callable outside hook context (e.g. SetupPage)
export async function addChild({ familyId, name, avatarUrl, birthDate, gender }) {
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: familyId,
      name,
      avatar_url: avatarUrl ?? null,
      birth_date: birthDate ?? null,
      gender: gender ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export function useChildren(familyId) {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchChildren = useCallback(async () => {
    if (!familyId) return
    const { data } = await supabase
      .from('children')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
    setChildren(data ?? [])
    setLoading(false)
  }, [familyId])

  useEffect(() => {
    fetchChildren()
    const channel = supabase
      .channel(`children:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter: `family_id=eq.${familyId}` }, fetchChildren)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchChildren, familyId])

  async function updateChild(id, updates) {
    const { error } = await supabase
      .from('children')
      .update(updates)
      .eq('id', id)
    if (error) throw error
  }

  async function deleteChild(id) {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  return { children, loading, addChild, updateChild, deleteChild }
}
