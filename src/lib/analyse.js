// Analyse du texte lu sur les papiers de la voiture (voir ocr.js pour la lecture).
// Même principe que l'appli Zytho : pas d'IA, des règles simples qui repèrent les libellés
// imprimés (« A. », « TOTAL TTC », « N° de contrat »…) et tolèrent les erreurs de lecture.
// Chaque fonction renvoie seulement les champs trouvés ; l'utilisateur vérifie toujours.

/* ------------------------------ outils ------------------------------ */

/** Majuscules sans accents, apostrophes unifiées. */
export function normaliser(texte) {
  return (texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[‘’`´]/g, "'")
}

const lignesDe = (texte) => texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

const RE_DATE = /(\d{2})\s?[/.\-]\s?(\d{2})\s?[/.\-]\s?(\d{4})/g
const ANNEE = new Date().getFullYear()

function dateIso(j, m, a, anneeMax) {
  const [jj, mm, aa] = [Number(j), Number(m), Number(a)]
  if (jj < 1 || jj > 31 || mm < 1 || mm > 12 || aa < 1950 || aa > anneeMax) return null
  return `${a}-${m}-${j}`
}

/** Dates du texte au format ISO, dans l'ordre de lecture. */
function datesDe(texte, anneeMax = ANNEE) {
  return [...texte.matchAll(RE_DATE)].map((m) => dateIso(m[1], m[2], m[3], anneeMax)).filter(Boolean)
}

const aujourdhuiIso = () => new Date().toISOString().slice(0, 10)

/** Première date trouvée sur une ligne qui contient le libellé (ou la ligne suivante). */
function dateApresLibelle(lignes, reLibelle, anneeMax = ANNEE) {
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(reLibelle)
    if (!m) continue
    const d = datesDe(lignes[i].slice(m.index), anneeMax)[0] ?? datesDe(lignes[i + 1] ?? '', anneeMax)[0]
    if (d) return d
  }
  return ''
}

/** Kilométrage : nombre près de « kilométrage », « km », « compteur ». */
function kmDe(lignes) {
  const nombre = (s) => {
    const n = parseInt(s.replace(/[\s.]/g, ''), 10)
    return n >= 100 && n < 1000000 ? String(n) : ''
  }
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(/KILOMETRAGE|COMPTEUR|\bKMS?\b/)
    if (!m) continue
    for (const morceau of [lignes[i].slice(m.index), lignes[i], lignes[i + 1] ?? '']) {
      for (const n of morceau.matchAll(/\b(\d{1,3}(?:[ .]\d{3})+|\d{3,6})\b/g)) {
        // on écarte les années et les morceaux de date
        if (/^(19|20)\d{2}$/.test(n[1]) && /\d{2}[/.-]\d{2}[/.-]$/.test(morceau.slice(0, n.index))) continue
        const km = nombre(n[1])
        if (km) return km
      }
    }
  }
  const m = lignes.join('\n').match(/\b(\d{1,3}(?:[ .]\d{3})+|\d{3,6})\s*KMS?\b/)
  return m ? nombre(m[1]) : ''
}

/** Montants « 1 234,56 » ou « 180.00 », en nombre. */
function montantsDe(texte) {
  return [...texte.matchAll(/(\d{1,3}(?:[ . ]\d{3})+|\d+)[,.](\d{2})(?!\d)/g)].map((m) =>
    Number(m[1].replace(/[ . ]/g, '') + '.' + m[2]),
  )
}

const RE_TEL = /(?:\+33\s?\(?0?\)?\s?|\b0\s?)[1-9](?:[\s.-]?\d{2}){4}\b/g
const formaterTel = (t) => {
  const chiffres = t.replace(/\D/g, '').replace(/^33/, '0')
  return chiffres.replace(/(\d{2})(?=\d)/g, '$1 ')
}

const nettoyer = (valeur) =>
  valeur
    .replace(/^[\s.:,;|_-]+/, '')
    .replace(/[\s.:,;|_-]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)

/* --------------------------- carte grise --------------------------- */

// fin d'une valeur = début du code suivant sur la même ligne (« D.2 », « J.1 », « E. »…).
// L'OCR abîme souvent les codes (« D.1 » lu « DI », « D.3 » lu « P3 ») : on reste tolérant.
const RE_CODE_SUIVANT = /\s+(?:[A-Z]\s?[.,]?\s?\d(?:\s?[.,]?\s?\d)?\b|[A-Z]\s?\.\s|E\s?[.,:]?\s+(?=[A-Z0-9]{10}))/
const DS = '(?:^|\\s)D\\s?[.,]?\\s?' // « D. » bien lu
const D = '(?:^|\\s)[DPO0]\\s?[.,]?\\s?' // « D. » et ses variantes mal lues
const UN = '[1IL|]'

/** Valeur qui suit un code (même ligne, sinon ligne suivante). Essaie les codes dans l'ordre (strict puis tolérant). */
function valeurApres(lignes, ...codes) {
  const couper = (texte) => {
    const t = texte.trim()
    const c = t.search(RE_CODE_SUIVANT) // un code ne peut pas être le 1er mot : c'est la valeur
    return nettoyer(c >= 0 ? t.slice(0, c) : t)
  }
  for (const reCode of codes) {
    for (let i = 0; i < lignes.length; i++) {
      const m = lignes[i].match(reCode)
      if (!m) continue
      let v = couper(lignes[i].slice(m.index + m[0].length))
      if (!v && lignes[i + 1] && !/^\s*[A-Z]\s?[.,]\s?\d?/.test(lignes[i + 1])) v = couper(lignes[i + 1])
      if (v) return v
    }
  }
  return ''
}

function plaqueDe(texte) {
  const re = /\b([A-Z]{2})\s?[-–—]?\s?([0-9OIL]{3})\s?[-–—]?\s?([A-Z]{2})\b/g
  for (const m of texte.matchAll(re)) {
    const chiffres = m[2].replace(/O/g, '0').replace(/[IL]/g, '1')
    if ((m[2].match(/\d/g) || []).length >= 2) return `${m[1]}-${chiffres}-${m[3]}`
  }
  return ''
}

/** Un VIN fait 17 caractères et n'utilise jamais I, O ni Q. */
function vinDepuis(brut) {
  const s = brut.replace(/[^A-Z0-9]/g, '').replace(/I/g, '1').replace(/[OQ]/g, '0')
  if (s.length < 17) return ''
  const vin = s.slice(0, 17)
  const chiffres = (vin.match(/\d/g) || []).length
  // un VIN finit par 4 chiffres (numéro de série) et contient des lettres
  return /\d{4}$/.test(vin) && chiffres < 17 ? vin : ''
}

function vinDe(lignes) {
  for (const l of lignes) {
    const m = l.match(/(?:^|\s)E\s?[.,:]?\s+(.+)/)
    if (m) {
      const v = vinDepuis(m[1].split(RE_CODE_SUIVANT)[0])
      if (v) return v
    }
  }
  // sinon : n'importe quel mot de 17 caractères qui ressemble à un VIN
  for (const mot of lignes.join(' ').split(/\s+/)) {
    if (mot.replace(/[^A-Z0-9]/g, '').length === 17) {
      const v = vinDepuis(mot)
      if (v) return v
    }
  }
  return ''
}

/** Type mine / CNIT : une lettre puis deux chiffres (ex. M10…) ; on corrige les O/I lus à la place des 0/1. */
function cnit(brut) {
  const s = brut.replace(/[^A-Z0-9]/g, '')
  if (s.length < 8) return ''
  return s[0] + s.slice(1, 3).replace(/O/g, '0').replace(/[IL]/g, '1') + s.slice(3)
}

/**
 * Bande codée en bas de la carte grise (2 lignes avec des « < »), imprimée pour être lue par une machine :
 *   CRFRA + plaque (7) + contrôle + VIN (17) + contrôle + 1re immatriculation (AAMMJJ) + …
 *   carrosserie (4) + marque <<< modèle <<< n° de formule
 */
function bandeCodee(lignes) {
  const champs = {}
  const compactes = lignes.map((l) => l.replace(/[^A-Z0-9<]/g, ''))
  const i = compactes.findIndex((l) => /CRFRA/.test(l))
  if (i < 0) return champs
  const l1 = compactes[i].slice(compactes[i].indexOf('CRFRA') + 5)
  // plaque SIV : 2 lettres, 3 chiffres, 2 lettres (on corrige O/0 et I/1 selon la position)
  const p = l1.slice(0, 7)
  const lettres = (t) => t.replace(/0/g, 'O').replace(/1/g, 'I')
  const chiffres = (t) => t.replace(/O/g, '0').replace(/[IL]/g, '1')
  const plaque = `${lettres(p.slice(0, 2))}-${chiffres(p.slice(2, 5))}-${lettres(p.slice(5, 7))}`
  if (/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(plaque)) champs.plaque = plaque
  const vin = vinDepuis(l1.slice(8, 25))
  if (vin) champs.vin = vin
  const d = chiffres(l1.slice(26, 32))
  if (/^\d{6}$/.test(d)) {
    const aa = Number(d.slice(0, 2))
    const annee = aa > ANNEE % 100 ? 1900 + aa : 2000 + aa
    const iso = dateIso(d.slice(4, 6), d.slice(2, 4), String(annee), ANNEE)
    if (iso) champs.date_1re_immat = iso
  }
  const l2 = compactes[i + 1] ?? ''
  const morceaux = l2.slice(4).split(/<{2,}/).filter(Boolean)
  if (morceaux.length >= 2 && /^[A-Z][A-Z<-]+$/.test(morceaux[0])) champs.marque = morceaux[0].replace(/</g, ' ')
  if (morceaux.length >= 3 && /^[A-Z0-9][A-Z0-9<-]*$/.test(morceaux[1])) champs.modele = morceaux[1].replace(/</g, ' ')
  return champs
}

/** Carte grise → plaque, date_1re_immat, marque, modele, vin, type_mine. */
export function analyserCarteGrise(texteBrut) {
  const texte = normaliser(texteBrut)
  const lignes = lignesDe(texte)

  // B = date de 1re immatriculation ; à défaut, la plus ancienne date de la carte
  // (les autres dates — I, X.1 — sont forcément postérieures)
  let date = ''
  for (const l of lignes) {
    const m = l.match(/(?:^|\s)B\s?[.,:]?\s+(.*)/)
    const d = m && datesDe(m[1])[0]
    if (d) {
      date = d
      break
    }
  }
  if (!date) date = datesDe(texte).sort()[0] ?? ''

  const cases = garder({
    plaque: plaqueDe(texte),
    date_1re_immat: date,
    marque: valeurApres(lignes, new RegExp(`${DS}${UN}\\b\\.?`), new RegExp(`${D}${UN}\\b\\.?`)),
    modele: valeurApres(lignes, new RegExp(`${DS}3\\b\\.?`), new RegExp(`${D}3\\b\\.?`)),
    vin: vinDe(lignes),
    type_mine: cnit(
      valeurApres(lignes, new RegExp(`${DS}2\\s?[.,]?\\s?${UN}\\b\\.?`), new RegExp(`${D}2\\s?[.,]?\\s?${UN}\\b\\.?`)),
    ),
  })
  // la bande codée est la source la plus fiable ; les cases (A, B, D.1…) complètent
  return { ...cases, ...bandeCodee(lignes) }
}

const garder = (champs) => Object.fromEntries(Object.entries(champs).filter(([, v]) => v))

/* ---------------------- attestation d'assurance ---------------------- */

const ASSUREURS = [
  'AXA', 'MAAF', 'MACIF', 'MAIF', 'MATMUT', 'GMF', 'MMA', 'Allianz', 'Groupama', 'Generali', 'Pacifica',
  'Direct Assurance', 'Abeille Assurances', 'Aviva', 'Thélem', 'Aréas', 'AMV', 'Leocare', "L'olivier Assurance",
  'Ornikar', 'April', 'Sogessur', 'Suravenir', 'Crédit Mutuel', 'CIC', 'LCL', 'Cardif', 'Swiss Life', 'GAN',
  'Mutuelle de Poitiers', 'Mutuelle des Motards', 'Amaguiz', 'Acheel', 'Hiway', 'Lovys', 'Assu 2000',
  'Euro-Assurance', 'Crédit Agricole', 'Banque Populaire', "Caisse d'Epargne", 'Société Générale', 'Hello bank',
  'Boursorama', 'Altima', 'La Banque Postale', 'Eurofil', 'Zen Up', 'Wakam', 'Assurpeople', 'Mutuelle Saint-Christophe',
  'BPCE Assurances', 'Monceau', 'Mutuelle de l\'Est', 'Smacl', 'Macsf', 'Filia-Maif', 'Covéa',
]

/** Attestation d'assurance (ou « mémo véhicule assuré ») → assureur, numero_contrat, echeance_assurance, tel_assistance. */
export function analyserAttestation(texteBrut) {
  const texte = normaliser(texteBrut)
  const lignes = lignesDe(texte)

  // assureur cité le plus souvent (à égalité, le premier)
  let assureur = ''
  let meilleur = 0
  for (const nom of ASSUREURS) {
    const re = new RegExp(`(?:^|[^A-Z])${normaliser(nom).replace(/[-' ]/g, '[-\' ]?')}(?![A-Z])`, 'g')
    const n = (texte.match(re) || []).length
    if (n > meilleur) [assureur, meilleur] = [nom, n]
  }

  // n° de contrat / police / sociétaire
  let contrat = ''
  for (const motCle of [/CONTRAT/, /POLICE/, /SOCIETAIRE|ADHERENT/]) {
    for (let i = 0; i < lignes.length && !contrat; i++) {
      const m = lignes[i].match(motCle)
      if (!m) continue
      for (const morceau of [lignes[i].slice(m.index + m[0].length), lignes[i + 1] ?? '']) {
        const reste = morceau.replace(/^[\s:.]*(?:(?:N|NO|N°|NUMERO|NUM)\b[\s:.°]*)?(?:D'|DE\s)?[\s:.]*/, '')
        const t = reste.match(/^([A-Z]{0,4}[\s-]?\d[\dA-Z\s/.-]{2,22})/)
        if (t && (t[1].match(/\d/g) || []).length >= 4) {
          contrat = nettoyer(t[1].replace(/\s{2,}.*$/, ''))
          break
        }
      }
    }
  }

  // échéance : fin de la période « du … au … », sinon « jusqu'au / échéance / validité »
  let echeance = ''
  const periode = texte.match(/DU\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+AU\s+(\d{2}[/.-]\d{2}[/.-]\d{4})/)
  if (periode) echeance = datesDe(periode[2], ANNEE + 2)[0] ?? ''
  if (!echeance) echeance = dateApresLibelle(lignes, /JUSQU.?AU|ECHEANCE|EXPIR|FIN DE VALIDITE|VALABLE|VALIDITE/, ANNEE + 2)
  if (!echeance) echeance = datesDe(texte, ANNEE + 2).filter((d) => d >= aujourdhuiIso()).sort().pop() ?? ''

  // téléphone d'assistance : seulement s'il est à côté du mot « assistance » / « dépannage »
  let tel = ''
  for (let i = 0; i < lignes.length && !tel; i++) {
    if (!/ASSISTANCE|DEPANNAGE|REMORQUAGE|PANNE|ACCIDENT/.test(lignes[i])) continue
    const suivante = /AGENCE|CONSEILLER/.test(lignes[i + 1] ?? '') ? '' : (lignes[i + 1] ?? '')
    const t = `${lignes[i]} ${suivante}`.match(RE_TEL)
    if (t) tel = formaterTel(t[0])
  }

  return garder({ assureur, numero_contrat: contrat, echeance_assurance: echeance, tel_assistance: tel })
}

/* ----------------------------- factures ----------------------------- */

/** Facture de garage → date, km, cout, garage_id (si le garage est déjà dans le carnet). */
export function analyserFacture(texteBrut, garages = []) {
  const texte = normaliser(texteBrut)
  const lignes = lignesDe(texte)

  // date : « facture du … » / « date … », sinon la date la plus récente non future
  let date = dateApresLibelle(lignes, /FACTURE|DATE/)
  if (!date || date > aujourdhuiIso()) date = datesDe(texte).filter((d) => d <= aujourdhuiIso()).sort().pop() ?? ''

  // montant : le libellé le plus fiable d'abord
  let cout = null
  for (const libelle of [/NET A PAYER/, /TOTAL\s*T\.?T\.?C/, /MONTANT\s*T\.?T\.?C/, /TOTAL A PAYER|A PAYER/, /\bTTC\b/]) {
    for (let i = 0; i < lignes.length && cout == null; i++) {
      if (!libelle.test(lignes[i])) continue
      const montants = montantsDe(lignes[i]).concat(montantsDe(lignes[i + 1] ?? ''))
      if (montants.length) cout = montantsDe(lignes[i]).pop() ?? montants[0]
    }
    if (cout != null) break
  }
  if (cout == null) {
    const tous = montantsDe(texte).filter((m) => m < 20000)
    if (tous.length) cout = Math.max(...tous)
  }

  // garage déjà connu : par son nom ou son téléphone
  const telsTexte = (texte.match(RE_TEL) || []).map((t) => t.replace(/\D/g, '').slice(-9))
  const garage = garages.find(
    (g) =>
      (g.nom && normaliser(g.nom).length >= 3 && texte.includes(normaliser(g.nom))) ||
      (g.telephone && telsTexte.includes(g.telephone.replace(/\D/g, '').slice(-9))),
  )

  return garder({
    date,
    km: kmDe(lignes),
    cout: cout != null ? cout.toFixed(2).replace('.', ',') : '',
    garage_id: garage?.id ?? '',
  })
}

/* ----------------------- PV de contrôle technique ----------------------- */

/** PV de contrôle technique → date, km, et pour une contre-visite : contre_visite + date limite. */
export function analyserPV(texteBrut, garages = []) {
  const texte = normaliser(texteBrut)
  const lignes = lignesDe(texte)
  const facture = analyserFacture(texteBrut, garages) // prix et centre s'ils figurent sur le PV

  // date de la visite : libellé, sinon la date la plus récente non future
  // (le PV porte aussi la 1re immatriculation, plus ancienne, et la date limite, future)
  let date = dateApresLibelle(lignes, /DATE\s*(?:DE\s*(?:LA\s*)?)?(?:VISITE|CONTROLE|INSPECTION)/)
  if (!date || date > aujourdhuiIso()) date = datesDe(texte).filter((d) => d <= aujourdhuiIso()).sort().pop() ?? ''

  // contre-visite : la date limite indiquée tombe dans les ~2 mois après la visite
  // (sur un PV favorable, la seule date limite est celle du prochain CT, 2 ans plus tard)
  const limite = dateApresLibelle(lignes, /AVANT LE|DATE LIMITE|AU PLUS TARD|PROCHAIN/, ANNEE + 3)
  const ecartJours = date && limite ? (new Date(limite) - new Date(date)) / 86400000 : null
  const contreVisite = ecartJours != null && ecartJours > 0 && ecartJours <= 75

  return garder({
    ...facture,
    date,
    km: kmDe(lignes) || facture.km,
    contre_visite: contreVisite ? 'oui' : '',
    date_limite: contreVisite ? limite : '',
  })
}

/* ------------------- bouton « J'ai un papier » ------------------- */

/** Sorte de papier : contrôle technique, attestation d'assurance ou facture (null si on ne sait pas). */
export function sorteDePapier(texteBrut) {
  const t = normaliser(texteBrut)
  const points = {
    ct: (t.match(/CONTROLE TECHNIQUE|PROCES.?VERBAL|CONTRE.?VISITE|DEFAILLANCES?\s+(?:MAJEURE|MINEURE|CRITIQUE)|CENTRE DE CONTROLE/g) || []).length * 2,
    assurance: (t.match(/ATTESTATION D.?ASSURANCE|CARTE VERTE|MEMO VEHICULE|VEHICULE ASSURE|SOUSCRIPTEUR|CERTIFICAT INTERNATIONAL|PERIODE DE VALIDITE|RESPONSABILITE CIVILE/g) || []).length * 2,
    facture: (t.match(/FACTURE|NET A PAYER|TOTAL\s*T\.?T\.?C|MAIN D.?OEUVRE|\bHT\b|\bTVA\b/g) || []).length,
  }
  const [sorte, score] = Object.entries(points).sort((a, b) => b[1] - a[1])[0]
  return score > 0 ? sorte : null
}

// mots-clés → type d'intervention (le premier trouvé gagne : du plus spécifique au plus général)
const MOTS_INTERVENTION = [
  ['courroie', /DISTRIBUTION/],
  ['revision', /REVISION|ENTRETIEN (?:CONSTRUCTEUR|PERIODIQUE|ANNUEL)|FORFAIT ENTRETIEN|PLAN D.?ENTRETIEN/],
  ['plaquettes_av', /PLAQUETTES?[^\n]{0,30}(?:\bAV\b|AVANT)|(?:\bAV\b|AVANT)[^\n]{0,15}PLAQUETTES?/],
  ['plaquettes_ar', /PLAQUETTES?[^\n]{0,30}(?:\bAR\b|ARRIERE)|(?:\bAR\b|ARRIERE)[^\n]{0,15}PLAQUETTES?/],
  ['disques_av', /DISQUES?[^\n]{0,30}(?:\bAV\b|AVANT)/],
  ['disques_ar', /DISQUES?[^\n]{0,30}(?:\bAR\b|ARRIERE)/],
  ['vidange', /VIDANGE|HUILE MOTEUR/],
  ['batterie', /BATTERIE/],
  ['pneus', /PNEUMATIQUE|\bPNEUS?\b/],
  ['essuie_glaces', /BALAIS?\b|ESSUIE.?GLACE/],
  ['filtres', /FILTRE/],
]

export function typeIntervention(texteBrut) {
  const t = normaliser(texteBrut)
  return MOTS_INTERVENTION.find(([, re]) => re.test(t))?.[0] ?? null
}

/** Voiture de la famille dont la plaque figure sur le papier (null sinon). */
export function voitureDuPapier(texteBrut, voitures = []) {
  const t = normaliser(texteBrut)
  const compact = t.replace(/[^A-Z0-9]/g, '')
  // l'OCR confond souvent O/0 et I/1 : on compare en remplaçant les deux côtés
  const flou = (s) => s.replace(/O/g, '0').replace(/[IL]/g, '1')
  const plaqueLue = plaqueDe(t)
  for (const v of voitures) {
    const p = (v.plaque || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (p.length < 5) continue
    if (compact.includes(p) || flou(compact).includes(flou(p)) || (plaqueLue && plaqueLue.replace(/-/g, '') === p)) return v
  }
  return null
}

/**
 * Tout ce qu'on peut tirer d'un papier quelconque : sorte, voiture, type d'intervention et champs lus.
 * Renvoie aussi `sur` = true quand on peut se contenter d'une confirmation en une ligne.
 */
export function analyserPapier(texteBrut, { garages = [], voitures = [], sorte: sorteImposee = null } = {}) {
  const sorte = sorteImposee ?? sorteDePapier(texteBrut)
  const voiture = voitureDuPapier(texteBrut, voitures)
  let champs = {}
  let type = null
  if (sorte === 'assurance') champs = analyserAttestation(texteBrut)
  else if (sorte === 'ct') {
    champs = analyserPV(texteBrut, garages)
    type = 'controle_technique'
  } else if (sorte === 'facture') {
    champs = analyserFacture(texteBrut, garages)
    type = typeIntervention(texteBrut)
  }
  return { sorte, vehicle_id: voiture?.id ?? null, type, champs }
}
