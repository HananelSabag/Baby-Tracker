import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Wraps Supabase auth session — returns user and loading state
export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = loading, null = no session
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange fires immediately with INITIAL_SESSION —
    // this correctly handles OAuth redirects without a double-render flash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'INITIAL_SESSION') setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, loading, signInWithGoogle, signOut }
}
