import { useState } from 'react'
import { supabase, q } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { nomPersonne } from '../lib/format.js'
import { Bouton, Carte, Champ, Erreur, Input, Titre, useCharger } from '../components/ui.jsx'

async function charger() {
  const [membres, invitations] = await Promise.all([
    q(supabase.from('profiles').select('id, prenom, email, est_admin, est_membre').order('created_at')),
    q(supabase.from('invitations').select('*').order('created_at')),
  ])
  return { membres, invitations }
}

export default function Reglages() {
  const { profil, chargerProfil } = useAuth()
  const { data, recharger } = useCharger(charger)
  const [prenom, setPrenom] = useState(profil.prenom ?? '')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function action(fn, ok) {
    setErreur(null)
    setMessage(null)
    try {
      await fn()
      if (ok) setMessage(ok)
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  const enregistrerPrenom = (e) => {
    e.preventDefault()
    action(async () => {
      await q(supabase.from('profiles').update({ prenom: prenom.trim() }).eq('id', profil.id))
      await chargerProfil()
    }, 'Prénom enregistré.')
  }

  const inviter = (e) => {
    e.preventDefault()
    const adresse = email.trim().toLowerCase()
    action(async () => {
      await q(supabase.from('invitations').upsert({ email: adresse, invite_par: profil.id }, { ignoreDuplicates: true }))
      setEmail('')
    }, `${adresse} peut maintenant se connecter à l'app avec son email. Envoie-lui le lien !`)
  }

  const basculerAdmin = (m) =>
    action(() => q(supabase.from('profiles').update({ est_admin: !m.est_admin }).eq('id', m.id)))
  const retirerFamille = (m) =>
    confirm(`Retirer ${nomPersonne(m)} de la famille ? Il/elle ne verra plus rien.`) &&
    action(async () => {
      await q(supabase.from('profiles').update({ est_membre: false, est_admin: false }).eq('id', m.id))
      await q(supabase.from('invitations').delete().eq('email', m.email))
    })

  const lienApp = window.location.origin + import.meta.env.BASE_URL
  const membres = data?.membres.filter((m) => m.est_membre) ?? []
  const emailsInscrits = new Set(data?.membres.map((m) => m.email))
  const enAttente = data?.invitations.filter((i) => !emailsInscrits.has(i.email)) ?? []

  return (
    <div className="space-y-6">
      <Erreur message={erreur} />
      {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section>
        <Titre>Mon profil</Titre>
        <Carte>
          <form onSubmit={enregistrerPrenom} className="space-y-3">
            <Champ label="Prénom affiché" aide={profil.email}>
              <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </Champ>
            <Bouton variante="secondaire" className="w-full">
              Enregistrer
            </Bouton>
          </form>
        </Carte>
      </section>

      <section>
        <Titre>Inviter quelqu'un</Titre>
        <Carte className="space-y-3">
          <form onSubmit={inviter} className="flex gap-2">
            <Input type="email" required placeholder="email@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Bouton>Inviter</Bouton>
          </form>
          <p className="text-sm text-slate-600">
            Puis envoie-lui le lien de l'app :{' '}
            <button className="font-mono text-sky-600" onClick={() => navigator.clipboard?.writeText(lienApp)}>
              {lienApp}
            </button>
          </p>
          {enAttente.length > 0 && (
            <p className="text-sm text-slate-500">En attente de connexion : {enAttente.map((i) => i.email).join(', ')}</p>
          )}
        </Carte>
      </section>

      <section>
        <Titre>La famille</Titre>
        <Carte className="divide-y divide-slate-100 p-0">
          {membres.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">
                  {nomPersonne(m)} {m.est_admin && <span className="text-xs text-sky-700">admin</span>}
                </p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              {profil.est_admin && m.id !== profil.id && (
                <div className="flex gap-3 text-xs">
                  <button className="text-sky-600" onClick={() => basculerAdmin(m)}>
                    {m.est_admin ? 'retirer admin' : 'rendre admin'}
                  </button>
                  <button className="text-slate-400" onClick={() => retirerFamille(m)}>
                    retirer
                  </button>
                </div>
              )}
            </div>
          ))}
        </Carte>
      </section>

      <section>
        <Titre>Installer l'app</Titre>
        <Carte className="space-y-1 text-sm text-slate-600">
          <p>
            <b>iPhone</b> : dans Safari, bouton Partager → « Sur l'écran d'accueil ».
          </p>
          <p>
            <b>Android</b> : dans Chrome, menu ⋮ → « Installer l'application ».
          </p>
          <p className="text-slate-400">Les notifications de rappel arrivent en V2.</p>
        </Carte>
      </section>

      <Bouton variante="secondaire" className="w-full" onClick={() => supabase.auth.signOut()}>
        Se déconnecter
      </Bouton>
    </div>
  )
}
