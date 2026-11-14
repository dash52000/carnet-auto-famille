import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, q } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'
import { ICONE_TYPE, LIBELLE_TYPE } from '../../lib/constantes.js'
import { lienFichier } from '../../lib/images.js'
import { fmtDate, fmtDateApprox, fmtEuros, fmtKm, fmtKmApprox, nomPersonne } from '../../lib/format.js'
import { Carte, Erreur } from '../../components/ui.jsx'

export default function Historique({ events, releves, documents, recharger }) {
  const { profil } = useAuth()
  const [erreur, setErreur] = useState(null)
  const [voirKm, setVoirKm] = useState(false)

  const facturesParEvent = documents.reduce((acc, d) => {
    if (d.event_id) (acc[d.event_id] ??= []).push(d)
    return acc
  }, {})

  async function supprimer(ev) {
    if (!confirm('Supprimer cette intervention ?')) return
    try {
      await q(supabase.from('events').delete().eq('id', ev.id))
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function ouvrir(doc) {
    try {
      window.open(await lienFichier(doc.fichier_path), '_blank')
    } catch (e) {
      setErreur(e.message)
    }
  }

  if (!events.length) return <Carte className="text-sm text-slate-500">Rien pour l'instant. Utilise le bouton + pour ajouter une intervention.</Carte>

  return (
    <div className="space-y-3">
      <Erreur message={erreur} />
      {events.map((ev) => {
        const peutSupprimer = ev.auteur_id === profil.id || profil.est_admin
        const titre = ev.type === 'autre' ? ev.libelle || 'Autre' : LIBELLE_TYPE[ev.type]
        if (ev.type === 'info')
          return (
            <p key={ev.id} className="px-1 text-sm text-slate-500">
              💬 <b className="text-slate-700">{nomPersonne(ev.auteur)}</b> {ev.libelle} · {fmtDate(ev.created_at)}
            </p>
          )
        return (
          <Carte key={ev.id} className="flex gap-3">
            <span className="text-2xl">{ICONE_TYPE[ev.type]}</span>
            <div className="min-w-0 flex-1">
              <p>
                <b>{nomPersonne(ev.auteur)}</b> · {titre}
                {ev.type !== 'autre' && ev.libelle ? ` (${ev.libelle})` : ''}
              </p>
              <p className="text-sm text-slate-600">
                {[fmtDateApprox(ev.date, ev.date_approx), ev.km != null && fmtKmApprox(ev.km, ev.km_approx), fmtEuros(ev.cout)]
                  .filter(Boolean)
                  .join(' – ')}
                {ev.date_approx && (
                  <Link to={`/ajout?voiture=${ev.vehicle_id}&type=${ev.type}`} className="ml-2 text-sky-600">
                    préciser
                  </Link>
                )}
              </p>
              {ev.garage && <p className="text-sm text-slate-500">🔧 {ev.garage.nom}</p>}
              {ev.note && <p className="mt-1 text-sm text-slate-700">{ev.note}</p>}
              {facturesParEvent[ev.id]?.map((d) => (
                <button key={d.id} onClick={() => ouvrir(d)} className="mr-3 mt-1 text-sm text-sky-600">
                  📎 Facture
                </button>
              ))}
            </div>
            {peutSupprimer && (
              <button onClick={() => supprimer(ev)} aria-label="Supprimer" className="self-start text-slate-300">
                ✕
              </button>
            )}
          </Carte>
        )
      })}

      {releves.length > 0 && (
        <div>
          <button className="text-sm text-slate-500 underline" onClick={() => setVoirKm(!voirKm)}>
            {voirKm ? 'Masquer' : 'Voir'} les relevés de kilométrage ({releves.length})
          </button>
          {voirKm && (
            <Carte className="mt-2 divide-y divide-slate-100 p-0 text-sm">
              {releves.map((r) => (
                <div key={r.id} className="flex justify-between px-4 py-2">
                  <span>{fmtDate(r.date)}</span>
                  <span>{fmtKmApprox(r.km, r.km_approx)}</span>
                </div>
              ))}
            </Carte>
          )}
        </div>
      )}
    </div>
  )
}
