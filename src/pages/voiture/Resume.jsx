import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, q } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'
import { trierParUrgence } from '../../lib/echeances.js'
import { fmtDate, fmtEuros, fmtKm } from '../../lib/format.js'
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

/** Infos laissées de côté à la création, à remplir quand on les a sous la main. */
function aCompleter(v, events) {
  const liste = []
  const lien = (section) => `/voiture/${v.id}/modifier?section=${section}`
  const ajout = (type) => `/ajout?voiture=${v.id}&type=${type}`
  const ageAns = v.date_1re_immat ? (Date.now() - new Date(v.date_1re_immat)) / (365.25 * 86400000) : null

  if (!events.some((e) => e.type === 'revision'))
    liste.push({ icone: '🔧', label: 'Dernière révision', detail: 'Une photo de la facture suffit', to: ajout('revision') })
  if (!events.some((e) => e.type === 'controle_technique') && !v.prochain_ct && (ageAns == null || ageAns >= 4))
    liste.push({ icone: '📋', label: 'Dernier contrôle technique', detail: 'Une photo du PV suffit', to: ajout('controle_technique') })
  if (!v.assureur || !v.echeance_assurance)
    liste.push({ icone: '🛡️', label: 'Assurance', detail: 'Une photo ou le PDF de l’attestation suffit', to: lien('assurance') })
  if (!v.dimension_pneus) liste.push({ icone: '🛞', label: 'Dimension des pneus', detail: 'Inscrite sur le flanc du pneu', to: `/voiture/${v.id}?onglet=pneus` })
  if (!v.garage_habituel_id) liste.push({ icone: '🏠', label: 'Garage habituel', detail: 'Proposé par défaut à chaque saisie', to: lien('entretien') })
  return liste
}

export default function Resume({ voiture: v, events, echeances, recharger }) {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [erreur, setErreur] = useState(null)

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

  const manquants = v.archivee ? [] : aCompleter(v, events)

  return (
    <div className="space-y-5">
      <Erreur message={erreur} />

      {manquants.length > 0 && (
        <section>
          <Titre>À compléter</Titre>
          <Carte className="divide-y divide-slate-100 p-0">
            {manquants.map((m) => (
              <Link key={m.label} to={m.to} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                <span className="text-xl">{m.icone}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.label}</p>
                  <p className="text-sm text-slate-500">{m.detail}</p>
                </div>
                <span className="text-slate-400">›</span>
              </Link>
            ))}
          </Carte>
        </section>
      )}

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
