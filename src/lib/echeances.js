import { aujourdhui, ajouterMois, ajouterJours, joursAvant, dansXJours, fmtDate, fmtKm } from './format.js'
import { pneusDansLEtat } from './pneus.js'

const inconnu = (v, cle) => (v.inconnus ?? []).includes(cle)

// Statuts : 'retard' (rouge) · 'bientot' (orange) · 'ok' (vert) · 'inconnu' (gris)
export const COULEUR_STATUT = {
  retard: 'bg-red-500',
  bientot: 'bg-amber-400',
  ok: 'bg-emerald-500',
  inconnu: 'bg-slate-300',
}
const RANG = { retard: 0, bientot: 1, inconnu: 2, ok: 3 }

/** Moyenne de km par jour à partir des relevés et interventions (null si pas assez de données). */
export function kmParJour(points) {
  const pts = points.filter((p) => p.km != null && p.date).sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 2) return null
  const premier = pts[0]
  const dernier = pts[pts.length - 1]
  const jours = (new Date(dernier.date) - new Date(premier.date)) / 86400000
  if (jours < 14 || dernier.km <= premier.km) return null
  return (dernier.km - premier.km) / jours
}

function revision(v, events, rythme) {
  const derniere = events.find((e) => e.type === 'revision')
  if (!derniere) {
    // « je ne sais pas » : hypothèse prudente, une révision est à prévoir
    return inconnu(v, 'revision')
      ? { cle: 'revision', label: 'Révision', statut: 'bientot', detail: 'À faire : date de la dernière inconnue' }
      : { cle: 'revision', label: 'Révision', statut: 'inconnu', detail: 'Dernière révision pas encore renseignée' }
  }
  const dateDue = ajouterMois(derniere.date, v.intervalle_revision_mois)
  const kmDu = derniere.km != null ? derniere.km + v.intervalle_revision_km : null
  let jours = joursAvant(dateDue)
  let parKm = false
  const kmRestants = kmDu != null && v.km_actuel != null ? kmDu - v.km_actuel : null
  if (kmRestants != null && rythme) {
    const joursKm = Math.round(kmRestants / rythme)
    if (joursKm < jours) {
      jours = joursKm
      parKm = true
    }
  }
  const enRetard = jours < 0 || (kmRestants != null && kmRestants <= 0)
  const statut = enRetard ? 'retard' : jours <= 30 || (kmRestants != null && kmRestants <= 1000) ? 'bientot' : 'ok'
  const detailKm = kmDu != null ? ` ou ${derniere.km_approx ? '~' : ''}${fmtKm(kmDu)}` : ''
  const tilde = derniere.date_approx ? '~' : ''
  return {
    cle: 'revision',
    label: 'Révision',
    statut,
    jours,
    detail: enRetard
      ? `En retard (prévue ${tilde ? 'vers le' : 'le'} ${fmtDate(dateDue)}${detailKm})`
      : `${tilde}${fmtDate(parKm ? ajouterJours(aujourdhui(), jours) : dateDue)}${detailKm} · ${dansXJours(jours)}${parKm ? ' (estimé au km)' : ''}`,
  }
}

function controleTechnique(v, events) {
  let date = v.prochain_ct
  let estime = false
  if (!date) {
    const dernier = events.find((e) => e.type === 'controle_technique')
    if (dernier) {
      date = ajouterMois(dernier.date, 24)
      estime = dernier.date_approx
    } else if (v.date_1re_immat) {
      // pas de CT connu : règle française depuis la 1re immatriculation (4 ans, puis tous les 2 ans)
      date = ajouterMois(v.date_1re_immat, 48)
      if (joursAvant(date) < 0) {
        estime = true
        while (joursAvant(date) < 0) date = ajouterMois(date, 24)
      }
    }
  }
  if (!date) return { cle: 'ct', label: 'Contrôle technique', statut: 'inconnu', detail: 'Date de 1re immatriculation manquante' }
  const jours = joursAvant(date)
  const statut = jours < 0 ? 'retard' : jours <= 60 ? 'bientot' : 'ok'
  return {
    cle: 'ct',
    label: 'Contrôle technique',
    statut,
    jours,
    detail: `${estime ? '~' : ''}${fmtDate(date)} · ${dansXJours(jours)}${estime ? ' (estimé)' : ''}`,
  }
}

function assurance(v) {
  if (!v.echeance_assurance)
    return {
      cle: 'assurance',
      label: 'Assurance',
      statut: 'inconnu',
      detail: inconnu(v, 'assurance') ? 'Échéance inconnue' : 'Échéance non renseignée',
    }
  const jours = joursAvant(v.echeance_assurance)
  const statut = jours < 0 ? 'retard' : jours <= 30 ? 'bientot' : 'ok'
  return { cle: 'assurance', label: 'Assurance', statut, jours, detail: `${fmtDate(v.echeance_assurance)} · ${dansXJours(jours)}` }
}

/** Saison cible à une date : hiver entre le 15/10 et le 15/04. */
export function saisonCible(dateIso = aujourdhui()) {
  const md = dateIso.slice(5)
  return md >= '10-15' || md < '04-15' ? 'hiver' : 'ete'
}

function prochainChangement(dateIso = aujourdhui()) {
  const annee = Number(dateIso.slice(0, 4))
  const candidats = [`${annee}-04-15`, `${annee}-10-15`, `${annee + 1}-04-15`]
  return candidats.find((d) => d > dateIso)
}

function pneus(v, jeux) {
  const montes = jeux.filter((j) => j.statut === 'monte')
  if (!montes.length) return { cle: 'pneus', label: 'Pneus', statut: 'inconnu', detail: 'Aucun jeu de pneus monté renseigné' }
  const pire = montes.some((j) => j.etat === 'a_changer')
    ? 'a_changer'
    : montes.some((j) => j.etat === 'mi_use')
      ? 'mi_use'
      : montes.every((j) => j.etat === 'inconnu')
        ? 'inconnu'
        : 'neuf'
  if (pire === 'a_changer') {
    const lesquels = montes.flatMap((j) => pneusDansLEtat(j, 'a_changer'))
    const detail =
      lesquels.length === 1 ? `Pneu ${lesquels[0].toLowerCase()} à changer`
      : lesquels.length > 1 && lesquels.length < 4 ? `Pneus à changer : ${lesquels.join(', ').toLowerCase()}`
      : 'Pneus à changer'
    return { cle: 'pneus', label: 'Pneus', statut: 'retard', detail }
  }

  if (v.alterne_saisons) {
    const cible = saisonCible()
    const monte = montes[0]
    if (monte.saison !== '4saisons' && monte.saison !== cible) {
      return { cle: 'pneus', label: 'Pneus', statut: 'retard', detail: `Passer aux pneus ${cible === 'hiver' ? 'hiver' : 'été'}` }
    }
    const prochain = prochainChangement()
    const jours = joursAvant(prochain)
    if (jours <= 7) {
      return { cle: 'pneus', label: 'Pneus', statut: 'bientot', jours, detail: `Changement de saison ${dansXJours(jours)}` }
    }
  }
  if (pire === 'inconnu') return { cle: 'pneus', label: 'Pneus', statut: 'inconnu', detail: 'État des pneus inconnu' }
  return pire === 'mi_use'
    ? { cle: 'pneus', label: 'Pneus', statut: 'ok', detail: 'Mi-usés' }
    : { cle: 'pneus', label: 'Pneus', statut: 'ok', detail: 'En bon état' }
}

function releveKm(v, events, releves) {
  const dates = [...events.filter((e) => e.km != null).map((e) => e.date), ...releves.map((r) => r.date)].sort()
  const derniere = dates[dates.length - 1]
  if (!derniere) return { cle: 'km', label: 'Kilométrage', statut: 'bientot', detail: 'Aucun relevé de km' }
  const jours = -joursAvant(derniere)
  return jours > 30
    ? { cle: 'km', label: 'Kilométrage', statut: 'bientot', detail: `Dernier relevé il y a ${jours} j` }
    : { cle: 'km', label: 'Kilométrage', statut: 'ok', detail: `Relevé il y a ${jours} j` }
}

/**
 * Calcule toutes les échéances d'une voiture.
 * @param v voiture ; events triés du plus récent au plus ancien ; jeux de pneus ; relevés km
 */
export function echeancesVoiture(v, events = [], jeux = [], releves = []) {
  if (v.archivee) return []
  const points = [...events, ...releves].map((p) => ({ km: p.km, date: p.date }))
  const rythme = kmParJour(points)
  return [revision(v, events, rythme), controleTechnique(v, events), assurance(v), pneus(v, jeux), releveKm(v, events, releves)]
}

export function trierParUrgence(liste) {
  return [...liste].sort((a, b) => RANG[a.statut] - RANG[b.statut] || (a.jours ?? 9999) - (b.jours ?? 9999))
}

export function pireStatut(liste) {
  return trierParUrgence(liste)[0]?.statut ?? 'inconnu'
}
