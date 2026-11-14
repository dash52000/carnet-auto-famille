import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Bouton, Champ, Erreur, Input } from '../components/ui.jsx'

const CLE_CODE = 'carnet-auto-code'

/** Écran d'entrée : on arrive par le lien d'invitation (qui contient le code) et on donne son prénom. */
export default function Connexion() {
  const { session, chargerProfil } = useAuth()
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => {
    const duLien = params.get('code')
    if (duLien) localStorage.setItem(CLE_CODE, duLien)
    return (duLien || localStorage.getItem(CLE_CODE) || '').toUpperCase()
  })
  const [prenom, setPrenom] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  async function entrer(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) throw new Error(error.message)
      }
      // le code peut être collé sous forme de lien complet
      const codePropre = (code.match(/code=([A-Za-z0-9]+)/)?.[1] ?? code).trim().toUpperCase()
      const { error } = await supabase.rpc('rejoindre_famille', { p_code: codePropre, p_prenom: prenom.trim() })
      if (error) throw new Error(error.message.includes('incorrect') ? 'Code famille incorrect.' : error.message)
      await chargerProfil()
    } catch (err) {
      setErreur(
        err.message.toLowerCase().includes('anonymous')
          ? "La connexion anonyme n'est pas activée dans Supabase (Authentication → Sign In / Providers)."
          : err.message,
      )
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" className="mx-auto mb-3 h-20 w-20" />
        <h1 className="text-2xl font-bold">Carnet auto famille</h1>
        <p className="text-slate-600">L'entretien de nos voitures, au même endroit.</p>
      </div>

      <form onSubmit={entrer} className="space-y-4">
        <Champ label="Ton prénom" aide="Affiché dans l'historique : « Papa a changé les plaquettes… »">
          <Input required value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Papa, Damien, Mamie…" />
        </Champ>
        <Champ label="Code famille" aide="Déjà rempli si tu as ouvert le lien d'invitation. Tu peux aussi coller le lien.">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            className="text-center font-mono text-xl tracking-widest uppercase"
          />
        </Champ>
        <Bouton className="w-full" disabled={envoi}>
          {envoi ? 'Un instant…' : 'Entrer'}
        </Bouton>
      </form>
      <Erreur message={erreur} />
    </div>
  )
}
