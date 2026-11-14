import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, q } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'
import { chargerProfils } from '../../lib/donnees.js'
import { trierParUrgence } from '../../lib/echeances.js'
import { fmtDate, fmtEuros, fmtKm, nomPersonne } from '../../lib/format.js'
import { Bouton, Carte, Erreur, Pastille, Titre } from '../../components/ui.jsx'

export function Copier({ valeur }) {
  const [ok, setOk] = useState(false)
  if (!valeur) return <span className="text-slate-400">—</span>
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valeur)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
      className="font-mono text-slate-900"
    >
      {valeur} <span className="text-xs text-sky-600">{ok ? 'copié ✓' : 'copier'}</span>
    </button>
  )
}

function Ligne({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

export default function Resume({ voiture: v, events, echeances, membres, recharger }) {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [erreur, setErreur] = useState(null)
  const [profils, setProfils] = useState(null)

  const annee = new Date().getFullYear().toString()
  const coutAnnee = events.filter((e) => e.date.startsWith(annee)).reduce((s, e) => s + Number(e.cout || 0), 0)

  async function action(fn) {
    setErreur(null)
    try {
      await fn()
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  const archiver = () =>
    action(() => q(supabase.from('vehicles').update({ archivee: !v.archivee }).eq('id', v.id)))

  async function supprimer() {
    if (!confirm(`Supprimer définitivement ${v.plaque} et tout son historique ?`)) return
    try {
      await q(supabase.from('vehicles').delete().eq('id', v.id))
      navigate('/', { replace: true })
    } catch (e) {
      setErreur(e.message)
    }
  }

  const ajouterMembre = (userId) =>
    action(() => q(supabase.from('vehicle_members').insert({ vehicle_id: v.id, user_id: userId })))
  const retirerMembre = (userId) => {
    if (membres.length <= 1) return setErreur('Il faut garder au moins un membre.')
    if (userId === profil.id && !confirm('Te retirer de cette voiture ? Tu ne la verras plus.')) return
    action(() => q(supabase.from('vehicle_members').delete().eq('vehicle_id', v.id).eq('user_id', userId)))
  }

  const idsMembres = new Set(membres.map((m) => m.user_id))

  return (
    <div className="space-y-5">
      <Erreur message={erreur} />

      <section>
        <Titre>Échéances</Titre>
        <Carte className="divide-y divide-slate-100 p-0">
          {trierParUrgence(echeances).map((e) => (
            <div key={e.cle} className="flex items-center gap-3 px-4 py-3">
              <Pastille statut={e.statut} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.label}</p>
                <p className="text-sm text-slate-600">{e.detail}</p>
              </div>
            </div>
          ))}
          {echeances.length === 0 && <p className="p-4 text-sm text-slate-500">Voiture archivée : plus de rappels.</p>}
        </Carte>
      </section>

      <section>
        <Titre
          action={
            <Link to={`/voiture/${v.id}/modifier`} className="text-sm font-medium text-sky-600">
              Modifier
            </Link>
          }
        >
          Infos
        </Titre>
        <Carte className="divide-y divide-slate-100 py-2">
          <Ligne label="Kilométrage">{fmtKm(v.km_actuel)}</Ligne>
          <Ligne label="1re immatriculation">{fmtDate(v.date_1re_immat)}</Ligne>
          <Ligne label="VIN">
            <Copier valeur={v.vin} />
          </Ligne>
          <Ligne label="Type mine">
            <Copier valeur={v.type_mine} />
          </Ligne>
          <Ligne label="Révision">
            tous les {v.intervalle_revision_mois} mois / {fmtKm(v.intervalle_revision_km)}
          </Ligne>
          <Ligne label="Garage habituel">{v.garage?.nom ?? '—'}</Ligne>
          <Ligne label="Assurance">{[v.assureur, v.numero_contrat].filter(Boolean).join(' · ') || '—'}</Ligne>
          <Ligne label={`Dépenses ${annee}`}>{fmtEuros(coutAnnee) || '0 €'}</Ligne>
        </Carte>
      </section>

      <section>
        <Titre>Qui suit cette voiture</Titre>
        <Carte className="space-y-2">
          {membres.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between">
              <span>{nomPersonne(m.profil)}</span>
              <button className="text-sm text-slate-500 underline" onClick={() => retirerMembre(m.user_id)}>
                retirer
              </button>
            </div>
          ))}
          {profils === null ? (
            <button className="text-sm font-medium text-sky-600" onClick={() => chargerProfils().then(setProfils)}>
              + Partager avec quelqu'un de la famille
            </button>
          ) : (
            <div className="flex flex-wrap gap-2 pt-2">
              {profils
                .filter((p) => !idsMembres.has(p.id))
                .map((p) => (
                  <button key={p.id} onClick={() => ajouterMembre(p.id)} className="rounded-full border border-sky-600 px-3 py-1 text-sm text-sky-700">
                    + {nomPersonne(p)}
                  </button>
                ))}
              {profils.filter((p) => !idsMembres.has(p.id)).length === 0 && (
                <p className="text-sm text-slate-500">
                  Tout le monde suit déjà cette voiture. Pour ajouter quelqu'un de nouveau : Réglages → Inviter.
                </p>
              )}
            </div>
          )}
        </Carte>
      </section>

      <div className="flex flex-col gap-2">
        <Bouton variante="secondaire" onClick={archiver}>
          {v.archivee ? 'Remettre en service' : 'Voiture vendue → archiver'}
        </Bouton>
        {profil?.est_admin && (
          <Bouton variante="danger" onClick={supprimer}>
            Supprimer la voiture
          </Bouton>
        )}
      </div>
    </div>
  )
}
