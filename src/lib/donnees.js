import { supabase, q } from './supabase.js'
import { echeancesVoiture } from './echeances.js'

const CLE_CACHE = 'carnet-auto-cache-v1'

/** Toutes les voitures visibles + leurs échéances calculées. */
export async function chargerVoitures() {
  const [voitures, events, jeux, releves] = await Promise.all([
    q(supabase.from('vehicles').select('*').order('created_at')),
    q(supabase.from('events').select('id, vehicle_id, type, date, km, date_approx, km_approx').order('date', { ascending: false })),
    q(supabase.from('tyre_sets').select('*')),
    q(supabase.from('mileage_readings').select('vehicle_id, km, date').order('date', { ascending: false })),
  ])
  const resultat = voitures.map((v) => {
    const ev = events.filter((e) => e.vehicle_id === v.id)
    const je = jeux.filter((j) => j.vehicle_id === v.id)
    const re = releves.filter((r) => r.vehicle_id === v.id)
    return { ...v, events: ev, jeux: je, echeances: echeancesVoiture(v, ev, je, re) }
  })
  return resultat
}

/** Garde une copie locale des infos utiles en panne (consultables hors connexion). */
export function memoriserPourPanne(voiture, garage) {
  try {
    const cache = JSON.parse(localStorage.getItem(CLE_CACHE) || '{}')
    cache[voiture.id] = { voiture, garage, date: new Date().toISOString() }
    localStorage.setItem(CLE_CACHE, JSON.stringify(cache))
  } catch {
    /* stockage indisponible : tant pis */
  }
}

export function lirePanneHorsLigne(id) {
  try {
    return JSON.parse(localStorage.getItem(CLE_CACHE) || '{}')[id] ?? null
  } catch {
    return null
  }
}

/** Ajoute une voiture : l'id est créé ici pour éviter de relire la ligne avant que le créateur soit membre. */
export async function creerVoiture(champs) {
  const id = crypto.randomUUID()
  await q(supabase.from('vehicles').insert({ ...champs, id }))
  return id
}

export async function chargerProfils() {
  return q(supabase.from('profiles').select('id, prenom, email, est_admin').eq('est_membre', true).order('prenom'))
}

export async function chargerGarages() {
  return q(supabase.from('garages').select('*').order('nom'))
}
