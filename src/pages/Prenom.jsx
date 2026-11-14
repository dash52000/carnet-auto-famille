import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Bouton, Champ, Erreur, Input } from '../components/ui.jsx'

export default function Prenom() {
  const { user, chargerProfil } = useAuth()
  const [prenom, setPrenom] = useState('')
  const [erreur, setErreur] = useState(null)

  async function enregistrer(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update({ prenom: prenom.trim() }).eq('id', user.id)
    if (error) setErreur(error.message)
    else chargerProfil()
  }

  return (
    <form onSubmit={enregistrer} className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">Bienvenue !</h1>
      <Champ label="Comment la famille t'appelle ?" aide="Affiché dans l'historique : « Papa a changé les plaquettes… »">
        <Input required value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Papa, Damien, Mamie…" />
      </Champ>
      <Bouton>C'est parti</Bouton>
      <Erreur message={erreur} />
    </form>
  )
}
