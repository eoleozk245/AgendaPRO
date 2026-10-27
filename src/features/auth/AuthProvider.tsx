import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { AuthContext, type AuthState } from './auth-context.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    // O primeiro evento (INITIAL_SESSION) já traz a sessão salva, se existir.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ status: 'ready', session })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
