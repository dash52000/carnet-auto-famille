import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { chargerRetours, marquerVu, nombreATrier, texteRetour } from '../lib/papiers.js'
import InviteInstallation from '../components/InviteInstallation.jsx'
import { supabase } from '../lib/supabase.js'
import { chargerVoitures } from '../lib/donnees.js'
import { trierParUrgence, pireStatut } from '../lib/echeances.js'
import { fmtKm, fmtKmApprox } from '../lib/format.js'
import { Carte, Chargement, Erreur, Pastille, Titre, useCharger } from '../components/ui.jsx'
import QuestionRapide from '../components/QuestionRapide.jsx'

export default function Accueil() {
  const { data: voitures, erreur, chargement, recharger } = useCharger(chargerVoitures)
  const [voirArchives, setVoirArchives] = useState(false)
  const { profil } = useAuth()
  const [retours, setRetours] = useState([])
  const [aTrier, setATrier] = useState(0)

  useEffect(() => {
    chargerRetours(profil.id).then(setRetours).catch(() => {})
    if (profil.est_admin) nombreATrier().then(setATrier).catch(() => {})
  }, [profil.id, profil.est_admin])

  const vu = (id) => {
    setRetours((r) => r.filter((d) => d.id !== id))
    marquerVu(id).catch(() => {})
  }

  if (chargement) return <Chargement />
  const actives = voitures?.filter((v) => !v.archivee) ?? []
  const archives = voitures?.filter((v) => v.archivee) ?? []
  const aFaire = trierParUrgence(
    actives.flatMap((v) =>
      v.echeances.filter((e) => e.statut === 'retard' || e.statut === 'bientot').map((e) => ({ ...e, voiture: v })),
    ),
  )

  return (
    <div className="space-y-6">
      <Erreur message={erreur} />

      {retours.map((d) => (
        <button key={d.id} onClick={() => vu(d.id)} className="flex w-full items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-left">
          <span className="text-xl text-emerald-700">✓</span>
          <span className="flex-1 text-emerald-900">{texteRetour(d)} Merci !</span>
          <span className="text-sm text-emerald-700">✕</span>
        </button>
      ))}

      <Link
        to="/papier"
        className="flex items-center gap-4 rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm active:bg-slate-700"
      >
        <span className="text-3xl">📷</span>
        <span className="flex-1">
          <span className="block text-lg font-semibold">J'ai un papier</span>
          <span className="block text-sm text-slate-300">Facture, contrôle technique, assurance : une photo suffit</span>
        </span>
      </Link>

      {aTrier > 0 && (
        <Link to="/a-trier" className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 font-medium text-amber-900">
          <span>📥 {aTrier} papier{aTrier > 1 ? 's' : ''} à trier</span>
          <span>›</span>
        </Link>
      )}

      {voitures && <QuestionRapide voitures={voitures} recharger={recharger} />}

      {aFaire.length > 0 && (
        <section>
          <Titre>À faire bientôt</Titre>
          <Carte className="divide-y divide-slate-100 p-0">
            {aFaire.slice(0, 8).map((e) => (
              <Link key={e.voiture.id + e.cle} to={`/voiture/${e.voiture.id}`} className="flex items-center gap-3 px-4 py-3">
                <Pastille statut={e.statut} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {e.label} · <span className="text-slate-500">{e.voiture.plaque}</span>
                  </p>
                  <p className="truncate text-sm text-slate-600">{e.detail}</p>
                </div>
              </Link>
            ))}
          </Carte>
        </section>
      )}

      <section>
        <Titre
          action={
            <Link to="/voiture/nouvelle" className="text-sm font-medium text-sky-600">
              + Ajouter une voiture
            </Link>
          }
        >
          Nos voitures
        </Titre>
        {actives.length === 0 && (
          <Carte className="text-center text-slate-600">
            Aucune voiture pour l'instant.{' '}
            <Link to="/voiture/nouvelle" className="font-medium text-sky-600">
              Ajoute la première
            </Link>
            .
          </Carte>
        )}
        <div className="space-y-3">
          {actives.map((v) => (
            <CarteVoiture key={v.id} voiture={v} onKm={recharger} />
          ))}
        </div>
      </section>

      <InviteInstallation />

      {archives.length > 0 && (
        <section>
          <button className="text-sm text-slate-500 underline" onClick={() => setVoirArchives(!voirArchives)}>
            {voirArchives ? 'Masquer' : 'Voir'} les voitures vendues ({archives.length})
          </button>
          {voirArchives && (
            <div className="mt-3 space-y-2">
              {archives.map((v) => (
                <Link key={v.id} to={`/voiture/${v.id}`} className="block rounded-xl bg-slate-100 p-3 text-slate-600">
                  {v.plaque} · {v.marque} {v.modele}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function CarteVoiture({ voiture: v, onKm }) {
  const [km, setKm] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const pastilles = v.echeances.filter((e) => e.cle !== 'km')

  async function enregistrerKm(e) {
    e.preventDefault()
    const valeur = parseInt(km, 10)
    if (!valeur) return
    if (v.km_actuel && !v.km_actuel_approx && valeur < v.km_actuel && !confirm(`C'est moins que le dernier relevé (${fmtKm(v.km_actuel)}). Enregistrer quand même ?`)) return
    setEnvoi(true)
    await supabase.from('mileage_readings').insert({ vehicle_id: v.id, km: valeur })
    setEnvoi(false)
    setKm('')
    onKm()
  }

  return (
    <Carte>
      <div className="flex items-start gap-3">
        <Link to={`/voiture/${v.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Pastille statut={pireStatut(v.echeances)} />
            <span className="rounded-md border-2 border-slate-800 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">
              {v.plaque}
            </span>
          </div>
          <p className="mt-1 truncate font-medium">
            {[v.marque, v.modele].filter(Boolean).join(' ') || 'Modèle non renseigné'}
          </p>
          <p className="text-sm text-slate-500">{fmtKmApprox(v.km_actuel, v.km_actuel_approx)}</p>
        </Link>
        <Link
          to={`/voiture/${v.id}/panne`}
          className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700"
        >
          🚨 Panne
        </Link>
      </div>

      <Link to={`/voiture/${v.id}`} className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        {pastilles.map((e) => (
          <span key={e.cle} className="flex items-center gap-2 text-sm text-slate-700">
            <Pastille statut={e.statut} />
            {e.label}
          </span>
        ))}
      </Link>

      <form onSubmit={enregistrerKm} className="mt-3 flex gap-2">
        <input
          inputMode="numeric"
          placeholder="Nouveau km au compteur"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
        />
        <button disabled={!km || envoi} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
          OK
        </button>
      </form>
    </Carte>
  )
}
