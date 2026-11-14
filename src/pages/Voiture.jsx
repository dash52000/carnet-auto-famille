import { useSearchParams, useParams, Link } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { echeancesVoiture } from '../lib/echeances.js'
import { memoriserPourPanne } from '../lib/donnees.js'
import { fmtKm } from '../lib/format.js'
import { Chargement, Erreur, Onglets, Pastille, useCharger } from '../components/ui.jsx'
import Resume from './voiture/Resume.jsx'
import Pneus from './voiture/Pneus.jsx'
import Pieces from './voiture/Pieces.jsx'
import Historique from './voiture/Historique.jsx'
import Documents from './voiture/Documents.jsx'
import { pireStatut } from '../lib/echeances.js'

const ONGLETS = [
  { code: 'resume', label: 'Résumé' },
  { code: 'pneus', label: 'Pneus' },
  { code: 'pieces', label: 'Pièces' },
  { code: 'historique', label: 'Historique' },
  { code: 'documents', label: 'Documents' },
]

async function chargerVoiture(id) {
  const [voiture, events, jeux, releves, pieces, documents, membres] = await Promise.all([
    q(supabase.from('vehicles').select('*, garage:garages(*)').eq('id', id).single()),
    q(
      supabase
        .from('events')
        .select('*, garage:garages(id, nom, telephone), auteur:profiles(id, prenom, email)')
        .eq('vehicle_id', id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ),
    q(supabase.from('tyre_sets').select('*').eq('vehicle_id', id).order('created_at')),
    q(supabase.from('mileage_readings').select('*').eq('vehicle_id', id).order('date', { ascending: false })),
    q(supabase.from('parts').select('*').eq('vehicle_id', id)),
    q(supabase.from('documents').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })),
    q(supabase.from('vehicle_members').select('user_id, profil:profiles(id, prenom, email)').eq('vehicle_id', id)),
  ])
  memoriserPourPanne(voiture, voiture.garage)
  return {
    voiture,
    events,
    jeux,
    releves,
    pieces,
    documents,
    membres,
    echeances: echeancesVoiture(voiture, events, jeux, releves),
  }
}

export default function Voiture() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const onglet = params.get('onglet') || 'resume'
  const { data, erreur, chargement, recharger } = useCharger(() => chargerVoiture(id), [id])

  if (chargement) return <Chargement />
  if (!data) return <Erreur message={erreur || 'Voiture introuvable'} />
  const { voiture: v } = data

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Pastille statut={pireStatut(data.echeances)} />
            <span className="rounded-md border-2 border-slate-800 bg-white px-2 py-0.5 font-mono font-bold tracking-wider">
              {v.plaque}
            </span>
            {v.archivee && <span className="rounded bg-slate-200 px-2 text-xs">vendue</span>}
          </div>
          <p className="mt-1 text-lg font-semibold">{[v.marque, v.modele].filter(Boolean).join(' ') || 'Modèle ?'}</p>
          <p className="text-sm text-slate-500">{fmtKm(v.km_actuel)}</p>
        </div>
        <Link to={`/voiture/${v.id}/panne`} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">
          🚨 Panne
        </Link>
      </div>

      <Onglets onglets={ONGLETS} actif={onglet} onChange={(o) => setParams({ onglet: o }, { replace: true })} />
      <Erreur message={erreur} />

      {onglet === 'resume' && <Resume {...data} recharger={recharger} />}
      {onglet === 'pneus' && <Pneus {...data} recharger={recharger} />}
      {onglet === 'pieces' && <Pieces {...data} recharger={recharger} />}
      {onglet === 'historique' && <Historique {...data} recharger={recharger} />}
      {onglet === 'documents' && <Documents {...data} recharger={recharger} />}
    </div>
  )
}
