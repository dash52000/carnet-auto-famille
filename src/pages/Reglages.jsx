import { useState } from 'react'
import { supabase, q } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { nomPersonne } from '../lib/format.js'
import { Bouton, Carte, Champ, Erreur, Input, Titre, useCharger } from '../components/ui.jsx'

async function charger() {
  const [membres, code] = await Promise.all([
    q(supabase.from('profiles').select('id, prenom, est_admin, est_membre, created_at').eq('est_membre', true).order('created_at')),
    q(supabase.rpc('code_famille')),
  ])
  return { membres, code }
}

export default function Reglages() {
  const { profil, chargerProfil } = useAuth()
  const { data, recharger } = useCharger(charger)
  const [prenom, setPrenom] = useState(profil.prenom ?? '')
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

  const lien = data?.code ? `${window.location.origin}${import.meta.env.BASE_URL}#/?code=${data.code}` : ''

  async function partager() {
    const texte = "Rejoins le carnet d'entretien des voitures de la famille :"
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Carnet auto famille', text: texte, url: lien })
      } catch {
        /* partage annulé */
      }
    } else {
      await navigator.clipboard?.writeText(lien)
      setMessage('Lien copié !')
    }
  }

  const enregistrerPrenom = (e) => {
    e.preventDefault()
    action(async () => {
      await q(supabase.from('profiles').update({ prenom: prenom.trim() }).eq('id', profil.id))
      await chargerProfil()
    }, 'Prénom enregistré.')
  }

  const regenerer = () =>
    confirm("Changer le code ? L'ancien lien ne marchera plus pour les nouveaux venus (ceux déjà entrés gardent l'accès).") &&
    action(() => q(supabase.rpc('regenerer_code_famille')), 'Nouveau code créé.')

  const basculerAdmin = (m) => action(() => q(supabase.from('profiles').update({ est_admin: !m.est_admin }).eq('id', m.id)))
  const retirer = (m) =>
    confirm(`Retirer « ${nomPersonne(m)} » ? Pense aussi à changer le code si besoin.`) &&
    action(() => q(supabase.from('profiles').update({ est_membre: false, est_admin: false }).eq('id', m.id)))

  function quitter() {
    if (confirm("Te déconnecter de cet appareil ? Pour revenir, il faudra rouvrir le lien d'invitation (ton historique reste dans l'app).")) {
      supabase.auth.signOut()
    }
  }

  return (
    <div className="space-y-6">
      <Erreur message={erreur} />
      {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section>
        <Titre>Inviter la famille</Titre>
        <Carte className="space-y-3">
          <p className="text-sm text-slate-600">Envoie ce lien (WhatsApp, SMS…). La personne tape son prénom et c'est tout.</p>
          <div className="rounded-xl bg-slate-100 p-3 text-center">
            <p className="text-xs text-slate-500">Code famille</p>
            <p className="font-mono text-2xl font-bold tracking-widest">{data?.code ?? '…'}</p>
          </div>
          <Bouton className="w-full" onClick={partager} disabled={!lien}>
            📤 Partager le lien d'invitation
          </Bouton>
          {profil.est_admin && (
            <Bouton variante="discret" className="w-full text-sm" onClick={regenerer}>
              Changer le code
            </Bouton>
          )}
        </Carte>
      </section>

      <section>
        <Titre>Mon prénom</Titre>
        <Carte>
          <form onSubmit={enregistrerPrenom} className="flex gap-2">
            <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            <Bouton variante="secondaire">OK</Bouton>
          </form>
        </Carte>
      </section>

      <section>
        <Titre>La famille</Titre>
        <Carte className="divide-y divide-slate-100 p-0">
          {data?.membres.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <p className="font-medium">
                {nomPersonne(m)} {m.id === profil.id && <span className="text-xs text-slate-400">(moi)</span>}{' '}
                {m.est_admin && <span className="text-xs text-sky-700">admin</span>}
              </p>
              {profil.est_admin && m.id !== profil.id && (
                <div className="flex gap-3 text-xs">
                  <button className="text-sky-600" onClick={() => basculerAdmin(m)}>
                    {m.est_admin ? 'retirer admin' : 'rendre admin'}
                  </button>
                  <button className="text-slate-400" onClick={() => retirer(m)}>
                    retirer
                  </button>
                </div>
              )}
            </div>
          ))}
        </Carte>
        <p className="mt-2 text-xs text-slate-500">
          Chaque téléphone compte comme une entrée : si quelqu'un utilise deux appareils, son prénom apparaît deux fois.
        </p>
      </section>

      <section>
        <Titre>Installer l'app</Titre>
        <Carte className="space-y-1 text-sm text-slate-600">
          <p>
            <b>Android</b> : dans Chrome, menu ⋮ → « Installer l'application ».
          </p>
          <p>
            <b>iPhone</b> : dans Safari, bouton Partager → « Sur l'écran d'accueil ». Au 1er lancement depuis l'icône, il
            faudra redonner son prénom (le code est mémorisé si possible, sinon le recoller).
          </p>
          <p className="text-slate-400">Les notifications de rappel arrivent en V2.</p>
        </Carte>
      </section>

      <Bouton variante="discret" className="w-full text-sm" onClick={quitter}>
        Se déconnecter de cet appareil
      </Bouton>
    </div>
  )
}
