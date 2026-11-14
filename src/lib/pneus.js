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

// ---------- Usure de chaque pneu (vue de dessus) ----------
// tyre_sets.usure = { av_g: { etat, pct }, av_d, ar_g, ar_d } ; pct = usure estimée en % (facultatif).
// tyre_sets.etat = pire des 4, recalculé par la base (trigger) et ici pour l'affichage immédiat.

export const POSITIONS_PNEU = [
  { code: 'av_g', label: 'Avant gauche', court: 'AV G' },
  { code: 'av_d', label: 'Avant droit', court: 'AV D' },
  { code: 'ar_g', label: 'Arrière gauche', court: 'AR G' },
  { code: 'ar_d', label: 'Arrière droit', court: 'AR D' },
]

const GRAVITE = { inconnu: 0, neuf: 1, mi_use: 2, a_changer: 3 }

/** Usure estimée (%) → état : < 30 % neuf, 30-69 % mi-usé, ≥ 70 % à changer (≈ 3 mm de gomme restante). */
export function etatDuPct(pct) {
  if (pct == null) return null
  return pct >= 70 ? 'a_changer' : pct >= 30 ? 'mi_use' : 'neuf'
}

/** Les 4 pneus du jeu ; un jeu sans détail par pneu prend son état global sur les 4. */
export function usureDuJeu(jeu) {
  return Object.fromEntries(
    POSITIONS_PNEU.map(({ code }) => [code, jeu.usure?.[code] ?? { etat: jeu.etat ?? 'inconnu' }]),
  )
}

/** État global = le pire des 4 pneus connus ; « inconnu » si aucun n'est renseigné. */
export function etatGlobal(usure) {
  return Object.values(usure).reduce((pire, p) => (GRAVITE[p.etat] > GRAVITE[pire] ? p.etat : pire), 'inconnu')
}

/** Pneus d'un jeu dans un état donné, ex. ['Avant gauche', 'Avant droit']. */
export function pneusDansLEtat(jeu, etat) {
  if (!jeu.usure) return []
  return POSITIONS_PNEU.filter(({ code }) => jeu.usure[code]?.etat === etat).map((p) => p.label)
}
