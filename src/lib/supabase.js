import { createClient } from '@supabase/supabase-js'

// Clés publiques (conçues pour être dans le navigateur) — la sécurité est assurée par les règles RLS.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://shibiciavnoxrqqbzjez.supabase.co'
const cle = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_5JISasl5zkaYeVxFyjJeuw_nuit4dGn'

export const supabase = createClient(url, cle, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const BUCKET = 'documents'

/** Lance une requête Supabase et renvoie les données, ou lève une erreur lisible. */
export async function q(promesse) {
  const { data, error } = await promesse
  if (error) throw new Error(error.message)
  return data
}
