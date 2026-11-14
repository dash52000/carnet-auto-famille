import { supabase, q } from './supabase.js'
import { SAISONS } from './constantes.js'
import { aujourdhui } from './format.js'

/**
 * Passe une voiture aux pneus de la saison `cible` (question de saison sur l'accueil) :
 * le jeu monté part au box et prend la place du jeu qu'on remonte ; s'il n'y a pas de jeu
 * de cette saison au box, il est créé en 1 tap (état inconnu).
 */
export async function passerALaSaison(voiture, jeux, cible) {
  const monte = jeux.find((j) => j.statut === 'monte')
  const auBox = jeux.find((j) => j.statut === 'box' && j.saison === cible)
  if (monte)
    await q(
      supabase
        .from('tyre_sets')
        .update({ statut: 'box', emplacement_box: auBox?.emplacement_box ?? null, date_depot: aujourdhui() })
        .eq('id', monte.id),
    )
  if (auBox) await q(supabase.from('tyre_sets').update({ statut: 'monte', emplacement_box: null, date_depot: null }).eq('id', auBox.id))
  else await q(supabase.from('tyre_sets').insert({ vehicle_id: voiture.id, saison: cible, statut: 'monte', etat: 'inconnu' }))
  await q(
    supabase.from('events').insert({
      vehicle_id: voiture.id,
      type: 'changement_saison',
      km: voiture.km_actuel,
      km_approx: Boolean(voiture.km_actuel_approx),
      libelle: `${monte ? SAISONS[monte.saison] : '?'} → ${SAISONS[cible]}`,
    }),
  )
}
