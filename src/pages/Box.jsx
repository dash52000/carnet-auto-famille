import { Link } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { ETATS_PNEU, SAISONS } from '../lib/constantes.js'
import { fmtDate } from '../lib/format.js'
import { Carte, Chargement, Erreur, Titre, useCharger } from '../components/ui.jsx'

const ETAT = Object.fromEntries(ETATS_PNEU.map((e) => [e.code, e]))

export default function Box() {
  const { data, erreur, chargement } = useCharger(() =>
    q(
      supabase
        .from('tyre_sets')
        .select('*, voiture:vehicles(id, plaque, marque, modele, dimension_pneus, archivee)')
        .eq('statut', 'box')
        .order('emplacement_box', { nullsFirst: false }),
    ),
  )

  if (chargement) return <Chargement />
  const jeux = (data ?? []).filter((j) => !j.voiture?.archivee)

  return (
    <div>
      <Titre>Box à pneus</Titre>
      <Erreur message={erreur} />
      {jeux.length === 0 && (
        <Carte className="text-sm text-slate-500">
          Le box est vide. Les jeux marqués « Au box » dans l'onglet Pneus d'une voiture apparaissent ici.
        </Carte>
      )}
      <div className="space-y-3">
        {jeux.map((j) => (
          <Link key={j.id} to={`/voiture/${j.voiture.id}?onglet=pneus`} className="block">
            <Carte>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">📍 {j.emplacement_box || 'Emplacement ?'}</p>
                  <p>
                    {SAISONS[j.saison]} {j.marque && `· ${j.marque}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono font-bold text-slate-800">{j.voiture.plaque}</span>{' '}
                    {[j.voiture.marque, j.voiture.modele].filter(Boolean).join(' ')}
                  </p>
                  {j.voiture.dimension_pneus && <p className="font-mono text-xs text-slate-500">{j.voiture.dimension_pneus}</p>}
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium text-white ${ETAT[j.etat].couleur}`}>
                    {ETAT[j.etat].label}
                  </span>
                  {j.date_depot && <p className="mt-1 text-xs text-slate-500">depuis le {fmtDate(j.date_depot)}</p>}
                </div>
              </div>
            </Carte>
          </Link>
        ))}
      </div>
    </div>
  )
}
