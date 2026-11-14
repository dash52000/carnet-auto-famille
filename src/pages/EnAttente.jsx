import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Bouton } from '../components/ui.jsx'

export default function EnAttente() {
  const { profil, chargerProfil } = useAuth()
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">Presque prêt !</h1>
      <p className="text-slate-600">
        Ton compte <b>{profil?.email}</b> n'est pas encore dans la famille. Demande à un membre de t'inviter depuis
        Réglages → Inviter, puis appuie sur « Vérifier ».
      </p>
      <Bouton onClick={chargerProfil}>Vérifier</Bouton>
      <Bouton variante="discret" onClick={() => supabase.auth.signOut()}>
        Se déconnecter
      </Bouton>
    </div>
  )
}
