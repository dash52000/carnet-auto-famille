import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { lienFichier } from '../lib/images.js'
import { chargerATrier, resumeLecture, supprimerPapier } from '../lib/papiers.js'
import { fmtDate, nomPersonne } from '../lib/format.js'
import { Carte, Chargement, Erreur, Titre, useCharger } from '../components/ui.jsx'

/** Pile « À trier » : les papiers déposés en un geste, que l'admin complète tranquillement. */
export default function ATrier() {
  const { data, erreur, chargement, recharger } = useCharger(async () => {
    const [docs, voitures] = await Promise.all([
      chargerATrier(),
      q(supabase.from('vehicles').select('id, plaque, marque, modele').eq('archivee', false).order('created_at')),
    ])
    return { docs, voitures }
  })

  if (chargement) return <Chargement />
  const docs = data?.docs ?? []

  return (
    <div className="space-y-4">
      <Titre>Papiers à trier</Titre>
      <Erreur message={erreur} />
      {docs.length === 0 && <Carte className="text-center text-slate-600">✓ Rien à trier. Tout est rangé.</Carte>}
      {docs.map((d) => (
        <PapierATrier key={d.id} doc={d} voitures={data.voitures} recharger={recharger} />
      ))}
    </div>
  )
}

function PapierATrier({ doc, voitures, recharger }) {
  const [lien, setLien] = useState(null)
  const [erreur, setErreur] = useState(null)
  const lecture = doc.lecture ?? {}
  const estPdf = doc.fichier_path.endsWith('.pdf')

  useEffect(() => {
    lienFichier(doc.fichier_path).then(setLien).catch(() => {})
  }, [doc.fichier_path])

  async function action(fn) {
    setErreur(null)
    try {
      await fn()
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  const choisirVoiture = (id) => action(() => q(supabase.from('documents').update({ vehicle_id: id }).eq('id', doc.id)))
  const supprimer = () => confirm('Supprimer ce papier ? (il n’a rien à faire dans le carnet)') && action(() => supprimerPapier(doc))

  const champs = Object.fromEntries(Object.entries(lecture).filter(([k]) => !['sorte', 'type'].includes(k)))
  const resume = lecture.sorte && Object.keys(champs).length ? resumeLecture({ sorte: lecture.sorte, type: lecture.type, champs }) : null
  const vid = doc.vehicle_id
  const lienIntervention = `/ajout?voiture=${vid}${lecture.type ? `&type=${lecture.type}` : ''}&document=${doc.id}`
  const lienAssurance = `/voiture/${vid}/modifier?section=assurance&document=${doc.id}`

  return (
    <Carte className="space-y-3">
      <div className="flex gap-3">
        <a href={lien ?? undefined} target="_blank" rel="noreferrer" className="shrink-0">
          {lien && !estPdf ? (
            <img src={lien} alt="" className="h-24 w-20 rounded-lg bg-slate-100 object-cover" />
          ) : (
            <span className="flex h-24 w-20 items-center justify-center rounded-lg bg-slate-100 text-3xl">📄</span>
          )}
        </a>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{doc.nom || 'Papier'}</p>
          <p className="text-slate-500">
            {nomPersonne(doc.auteur)} · {fmtDate(doc.created_at)}
          </p>
          {doc.voiture && (
            <p className="mt-1">
              <span className="font-mono font-bold">{doc.voiture.plaque}</span> {[doc.voiture.marque, doc.voiture.modele].filter(Boolean).join(' ')}
            </p>
          )}
          {resume && <p className="mt-1 text-slate-700">Lu : {resume}</p>}
        </div>
      </div>

      {!vid ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Quelle voiture ?</p>
          <div className="flex flex-wrap gap-2">
            {voitures.map((v) => (
              <button key={v.id} onClick={() => choisirVoiture(v.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm font-bold">
                {v.plaque}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lecture.sorte !== 'assurance' && (
            <Link to={lienIntervention} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white">
              Compléter l’intervention
            </Link>
          )}
          {(lecture.sorte === 'assurance' || !lecture.sorte) && (
            <Link
              to={lienAssurance}
              className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-medium ${lecture.sorte === 'assurance' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}
            >
              C’est l’assurance
            </Link>
          )}
        </div>
      )}
      <Erreur message={erreur} />
      <button onClick={supprimer} className="text-xs text-slate-500 underline">
        Pas un papier de voiture : supprimer
      </button>
    </Carte>
  )
}
