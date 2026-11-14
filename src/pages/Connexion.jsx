import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Bouton, Champ, Erreur, Input } from '../components/ui.jsx'

export default function Connexion() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [etape, setEtape] = useState('email')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  async function envoyerCode(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setEnvoi(false)
    if (error) setErreur(error.message)
    else setEtape('code')
  }

  async function verifierCode(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setEnvoi(false)
    if (error) setErreur('Code incorrect ou expiré. Redemande un code.')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" className="mx-auto mb-3 h-20 w-20" />
        <h1 className="text-2xl font-bold">Carnet auto famille</h1>
        <p className="text-slate-600">L'entretien de nos voitures, au même endroit.</p>
      </div>

      {etape === 'email' ? (
        <form onSubmit={envoyerCode} className="space-y-4">
          <Champ label="Ton email">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Champ>
          <Bouton className="w-full" disabled={envoi}>
            {envoi ? 'Envoi…' : 'Recevoir un code'}
          </Bouton>
        </form>
      ) : (
        <form onSubmit={verifierCode} className="space-y-4">
          <p className="text-sm text-slate-600">
            Un email vient d'être envoyé à <b>{email}</b>. Tape le code reçu, ou clique sur le lien depuis ce téléphone.
          </p>
          <Champ label="Code reçu par email">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.4em]"
            />
          </Champ>
          <Bouton className="w-full" disabled={envoi || code.length < 6}>
            {envoi ? 'Vérification…' : 'Se connecter'}
          </Bouton>
          <Bouton type="button" variante="discret" className="w-full" onClick={() => setEtape('email')}>
            Changer d'email
          </Bouton>
        </form>
      )}
      <Erreur message={erreur} />
    </div>
  )
}
