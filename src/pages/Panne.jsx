import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { lirePanneHorsLigne, memoriserPourPanne } from '../lib/donnees.js'
import { lienFichier } from '../lib/images.js'

export default function Panne() {
  const { id } = useParams()
  const [infos, setInfos] = useState(() => lirePanneHorsLigne(id))
  const [docs, setDocs] = useState([])
  const [horsLigne, setHorsLigne] = useState(false)

  useEffect(() => {
    supabase
      .from('vehicles')
      .select('*, garage:garages(*)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setHorsLigne(true)
          return
        }
        memoriserPourPanne(data, data.garage)
        setInfos({ voiture: data, garage: data.garage })
      })
    supabase
      .from('documents')
      .select('*')
      .eq('vehicle_id', id)
      .in('type', ['assurance', 'carte_grise'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocs(data ?? []))
  }, [id])

  const v = infos?.voiture
  const garage = infos?.garage

  async function ouvrir(doc) {
    try {
      window.open(await lienFichier(doc.fichier_path), '_blank')
    } catch {
      alert('Document indisponible hors connexion.')
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl bg-red-700 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
      <div className="mb-4 flex items-center justify-between">
        <Link to={`/voiture/${id}`} className="text-2xl" aria-label="Retour">
          ←
        </Link>
        <span className="rounded-md border-2 border-white px-2 py-0.5 font-mono font-bold">{v?.plaque ?? '…'}</span>
      </div>
      <h1 className="mb-4 text-2xl font-bold">🚨 Panne / accident</h1>
      {horsLigne && <p className="mb-3 rounded-xl bg-red-900/50 p-3 text-sm">Hors connexion : infos enregistrées sur ce téléphone.</p>}

      <div className="space-y-3">
        <Bloc titre="1. Sécurité d'abord">
          Feux de détresse, gilet jaune <b>avant</b> de sortir, triangle à 30 m. Tout le monde derrière la glissière.
          Blessés : appelle le <b>112</b>.
        </Bloc>

        <Bloc titre="2. Assistance / dépannage">
          {v?.tel_assistance ? (
            <a href={`tel:${v.tel_assistance}`} className="mt-2 block rounded-xl bg-white py-4 text-center text-lg font-bold text-red-700">
              📞 Appeler l'assistance
            </a>
          ) : (
            <p>Numéro d'assistance non renseigné (fiche voiture → Modifier).</p>
          )}
          {v?.assureur && (
            <p className="mt-2 text-sm">
              {v.assureur} {v.numero_contrat && <>· contrat <b className="font-mono">{v.numero_contrat}</b></>}
            </p>
          )}
          <p className="mt-1 text-sm opacity-80">Sur autoroute : utilise les bornes orange ou appelle le 112.</p>
        </Bloc>

        {garage?.telephone && (
          <Bloc titre="3. Garage habituel">
            <a href={`tel:${garage.telephone}`} className="mt-2 block rounded-xl bg-white py-3 text-center font-bold text-red-700">
              📞 {garage.nom}
            </a>
          </Bloc>
        )}

        <Bloc titre="Documents">
          {docs.length === 0 && <p className="text-sm">Ajoute la carte grise et l'attestation dans l'onglet Documents.</p>}
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <button key={d.id} onClick={() => ouvrir(d)} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-red-700">
                {d.type === 'assurance' ? 'Attestation' : 'Carte grise'}
              </button>
            ))}
          </div>
          {v && (
            <p className="mt-2 text-sm">
              {[v.marque, v.modele].filter(Boolean).join(' ')} {v.vin && <>· VIN <span className="font-mono">{v.vin}</span></>}
            </p>
          )}
        </Bloc>

        <Bloc titre="Accident avec un autre véhicule">
          Remplis un constat amiable (papier ou appli e-constat auto), photographie les véhicules, la plaque adverse et les
          lieux. Ne signe rien que tu ne comprends pas. Déclare-le à l'assurance sous 5 jours ouvrés.
        </Bloc>
      </div>
    </div>
  )
}

function Bloc({ titre, children }) {
  return (
    <div className="rounded-2xl bg-red-800/60 p-4">
      <p className="mb-1 font-semibold">{titre}</p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}
