import { useCallback } from 'react'
import api, { keys } from '../lib/api'
import { useRealtimeQuery } from './useRealtimeQuery'

// Standalone — callable outside hook context (SetupPage creates the first child
// before any provider is mounted).
export async function addChild({ familyId, name, avatarUrl, birthDate, gender }) {
  return api.children.create(familyId, { name, avatarUrl, birthDate, gender })
}

export function useChildren(familyId) {
  const cacheKey = familyId ? keys.children(familyId) : null
  const fetcher = useCallback(() => api.children.list(familyId), [familyId])

  const { data, loading, refetch } = useRealtimeQuery({
    familyId,
    table: 'children',
    cacheKey,
    fetcher,
    initialData: EMPTY,
  })

  const updateChild = useCallback(async (id, updates) => {
    await api.children.update(familyId, id, updates)
    await refetch()
  }, [familyId, refetch])

  const deleteChild = useCallback(async (id) => {
    await api.children.remove(familyId, id)
    await refetch()
  }, [familyId, refetch])

  return { children: data ?? EMPTY, loading, addChild, updateChild, deleteChild }
}

const EMPTY = []
