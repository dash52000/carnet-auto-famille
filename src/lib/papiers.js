// Bouton « J'ai un papier » et pile « À trier » (voir specs 3.16).
import { supabase, q, BUCKET } from './supabase.js'
import { envoyerFichier } from './images.js'
import { LIBELLE_TYPE } from './constantes.js'
import { fmtDate, fmtEuros } from './format.js'

const minuscule = (t) => t.charAt(0).toLowerCase() + t.slice(1)
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1)

const CLE_DERNIERE = 'derniere-voiture'

/** Dernière voiture choisie sur ce téléphone (proposée par défaut). */
export function derniereVoiture() {
  try {
    return localStorage.getItem(CLE_DERNIERE)
  } catch {
    return null
  }
}
export function retenirVoiture(id) {
  try {
    if (id) localStorage.setItem(CLE_DERNIERE, id)
  } catch {
    /* navigation privée */
  }
}

export const TYPE_DOCUMENT_DE_SORTE = { facture: 'facture', ct: 'controle_technique', assurance: 'assurance' }
const NOM_SORTE = { facture: 'facture', ct: 'PV de contrôle technique', assurance: 'attestation d’assurance' }
export const nomSorte = (sorte) => NOM_SORTE[sorte] ?? 'papier'

const nombre = (s) => (s === '' || s == null ? null : Number(String(s).replace(',', '.')))

/** Ligne « Révision · 12/10/2026 · 85 000 km · 180 € » à faire confirmer. */
export function resumeLecture({ sorte, type, champs }) {
  if (sorte === 'assurance')
    return [
      'Assurance',
      champs.assureur,
      champs.echeance_assurance && `échéance ${fmtDate(champs.echeance_assurance)}`,
    ]
      .filter(Boolean)
      .join(' · ')
  return [
    LIBELLE_TYPE[type] ?? 'Intervention',
    champs.date && fmtDate(champs.date),
    champs.km && `${Number(champs.km).toLocaleString('fr-FR')} km`,
    champs.cout && `${champs.cout} €`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Assez d'infos lues pour une simple confirmation en une ligne ? */
export function lectureSure(analyse) {
  const { sorte, vehicle_id, type, champs } = analyse
  if (!vehicle_id) return false
  if (sorte === 'assurance') return Boolean(champs.assureur && champs.echeance_assurance)
  return Boolean(type && champs.date && ['facture', 'ct'].includes(sorte))
}

/**
 * Enregistre une intervention lue sur un papier (révision, CT, plaquettes…) avec son document.
 * - documentId : papier déjà déposé (pile « À trier ») ; sinon on envoie le fichier.
 * - auteurId : l'intervention apparaît au nom de la personne qui a déposé le papier.
 */
export async function enregistrerIntervention({ voiture, type, champs, fichier = null, documentId = null, auteurId = null }) {
  const valeurs = {
    vehicle_id: voiture.id,
    type,
    date: champs.date,
    date_approx: false,
    km: champs.km ? parseInt(champs.km, 10) : null,
    km_approx: false,
    cout: nombre(champs.cout),
    garage_id: champs.garage_id || null,
    note:
      champs.contre_visite && champs.date_limite ? `Contre-visite à faire avant le ${fmtDate(champs.date_limite)}` : (champs.note ?? null),
    ...(auteurId ? { auteur_id: auteurId } : {}),
  }
  // une info exacte remplace l'approximation donnée plus tôt (« il y a ~1 an »)
  const remplacee = ['revision', 'controle_technique'].includes(type)
    ? (await q(supabase.from('events').select('id').eq('vehicle_id', voiture.id).eq('type', type).eq('date_approx', true).limit(1)))[0]
    : null
  const eventId = remplacee?.id ?? crypto.randomUUID()
  if (remplacee) await q(supabase.from('events').update(valeurs).eq('id', eventId))
  else await q(supabase.from('events').insert({ id: eventId, ...valeurs }))

  const typeDoc = type === 'controle_technique' ? 'controle_technique' : 'facture'
  const nom = type === 'controle_technique' ? 'PV de contrôle technique' : `Facture ${LIBELLE_TYPE[type] ?? ''}`.trim()
  if (documentId) await rangerDocument(documentId, { vehicle_id: voiture.id, event_id: eventId, type: typeDoc, nom })
  else if (fichier) {
    const chemin = await envoyerFichier(voiture.id, fichier)
    await q(supabase.from('documents').insert({ vehicle_id: voiture.id, event_id: eventId, type: typeDoc, fichier_path: chemin, nom }))
  }
  // un CT saisi remplace une date forcée ; une contre-visite impose sa date limite
  if (type === 'controle_technique')
    await q(
      supabase
        .from('vehicles')
        .update({ prochain_ct: champs.contre_visite && champs.date_limite ? champs.date_limite : null })
        .eq('id', voiture.id),
    )
  return eventId
}

/** Met à jour l'assurance d'une voiture à partir d'une attestation lue. */
export async function enregistrerAssurance({ voiture, champs, fichier = null, documentId = null }) {
  const maj = Object.fromEntries(
    ['assureur', 'numero_contrat', 'echeance_assurance', 'tel_assistance'].filter((k) => champs[k]).map((k) => [k, champs[k]]),
  )
  await q(supabase.from('vehicles').update(maj).eq('id', voiture.id))
  if (documentId) await rangerDocument(documentId, { vehicle_id: voiture.id, type: 'assurance', nom: 'Attestation d’assurance' })
  else if (fichier) {
    const chemin = await envoyerFichier(voiture.id, fichier)
    await q(supabase.from('documents').insert({ vehicle_id: voiture.id, type: 'assurance', fichier_path: chemin, nom: 'Attestation d’assurance' }))
  }
  await q(supabase.from('events').insert({ vehicle_id: voiture.id, type: 'info', libelle: 'a mis à jour l’assurance (attestation)' }))
}

/** Papier déposé sans être enregistré : il attend dans la pile « À trier ». */
export async function deposerATrier({ fichier, analyse }) {
  const chemin = await envoyerFichier(analyse.vehicle_id ?? 'a-trier', fichier)
  await q(
    supabase.from('documents').insert({
      vehicle_id: analyse.vehicle_id,
      type: TYPE_DOCUMENT_DE_SORTE[analyse.sorte] ?? 'autre',
      fichier_path: chemin,
      nom: analyse.sorte ? majuscule(nomSorte(analyse.sorte)) : 'Papier à trier',
      a_trier: true,
      lecture: { sorte: analyse.sorte, type: analyse.type, ...analyse.champs },
    }),
  )
  if (analyse.vehicle_id)
    await q(supabase.from('events').insert({ vehicle_id: analyse.vehicle_id, type: 'info', libelle: `a déposé un papier (${nomSorte(analyse.sorte)})` }))
}

/** Le papier sort de la pile « À trier » ; son auteur le verra à sa prochaine ouverture. */
export async function rangerDocument(documentId, champs) {
  const { data: session } = await supabase.auth.getSession()
  const moi = session.session?.user?.id
  const [doc] = await q(supabase.from('documents').select('auteur_id').eq('id', documentId))
  await q(
    supabase
      .from('documents')
      .update({ ...champs, a_trier: false, trie_le: new Date().toISOString(), vu_par_auteur: !doc || doc.auteur_id === moi })
      .eq('id', documentId),
  )
}

/** Papiers en attente (pile « À trier »), du plus ancien au plus récent. */
export async function chargerATrier() {
  return q(
    supabase
      .from('documents')
      .select('*, auteur:profiles(id, prenom, email), voiture:vehicles(id, plaque, marque, modele)')
      .eq('a_trier', true)
      .order('created_at'),
  )
}

export async function nombreATrier() {
  const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('a_trier', true)
  return count ?? 0
}

export async function supprimerPapier(doc) {
  await q(supabase.from('documents').delete().eq('id', doc.id))
  await supabase.storage.from(BUCKET).remove([doc.fichier_path])
}

/** Papiers que j'ai déposés et que l'admin vient de ranger (retour au déposant). */
export async function chargerRetours(moi) {
  return q(
    supabase
      .from('documents')
      .select('id, type, nom, trie_le, voiture:vehicles(plaque, marque, modele), evenement:events(type, date, cout)')
      .eq('auteur_id', moi)
      .eq('vu_par_auteur', false)
      .not('trie_le', 'is', null)
      .order('trie_le'),
  )
}

export const marquerVu = (id) => q(supabase.from('documents').update({ vu_par_auteur: true }).eq('id', id))

/** « Ta facture (révision du 12/10, 180 €) a été rangée sur la Clio. » */
export function texteRetour(doc) {
  const voiture = doc.voiture ? (doc.voiture.modele || doc.voiture.marque || doc.voiture.plaque) : null
  const ev = doc.evenement
  const [quoi, accord] =
    doc.type === 'assurance'
      ? ['Ton attestation d’assurance', 'e']
      : doc.type === 'controle_technique'
        ? ['Ton PV de contrôle technique', '']
        : doc.type === 'facture'
          ? ['Ta facture', 'e']
          : [`Ton papier`, '']
  const detail = ev
    ? ` (${[`${minuscule(LIBELLE_TYPE[ev.type] ?? '')} du ${fmtDate(ev.date)}`, ev.cout != null && fmtEuros(ev.cout)]
        .filter(Boolean)
        .join(', ')})`
    : ''
  return `${quoi}${detail} a été rangé${accord}${voiture ? ` sur la ${voiture}` : ''}.`
}
