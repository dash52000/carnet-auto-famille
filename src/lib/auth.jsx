import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = on ne sait pas encore
  const [profil, setProfil] = useState(undefined) // undefined = en cours de chargement, null = introuvable

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const chargerProfil = useCallback(async () => {
    if (!session?.user) {
      setProfil(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfil(data ?? null)
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chargerProfil()
  }, [chargerProfil])

  return (
    <AuthContext.Provider value={{ session, profil, chargerProfil, user: session?.user ?? null }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
