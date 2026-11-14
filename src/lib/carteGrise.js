// Lecture d'une carte grise (certificat d'immatriculation français) par OCR dans le navigateur.
// Même principe que l'appli Zytho avec ML Kit : on lit le texte sur le téléphone (Tesseract.js,
// gratuit, sans clé, la photo ne part nulle part), puis on repère les champs grâce à leurs codes
// imprimés sur la carte : A (plaque), B (1re immatriculation), D.1, D.2.1, D.3, E (VIN).

const RE_DATE = /(\d{2})\s?[/.\-]\s?(\d{2})\s?[/.\-]\s?(\d{4})/g
// fin d'une valeur = début du code suivant sur la même ligne (« D.2 », « J.1 », « E. »…).
// L'OCR abîme souvent les codes (« D.1 » lu « DI », « D.3 » lu « P3 ») : on reste tolérant.
const RE_CODE_SUIVANT = /\s+(?:[A-Z]\s?[.,]?\s?\d(?:\s?[.,]?\s?\d)?\b|[A-Z]\s?\.\s|E\s?[.,:]?\s+(?=[A-Z0-9]{10}))/
const D = '(?:^|\\s)[DPO0]\\s?[.,]?\\s?' // « D. » et ses variantes mal lues
const UN = '[1IL|]'

function nettoyer(valeur) {
  return valeur
    .replace(/^[\s.:,;|_-]+/, '')
    .replace(/[\s.:,;|_-]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function dateIso(j, m, a) {
  const [jj, mm, aa] = [Number(j), Number(m), Number(a)]
  if (jj < 1 || jj > 31 || mm < 1 || mm > 12 || aa < 1950 || aa > new Date().getFullYear()) return null
  return `${a}-${m}-${j}`
}

function datesDe(texte) {
  return [...texte.matchAll(RE_DATE)].map((m) => dateIso(m[1], m[2], m[3])).filter(Boolean)
}

/** Valeur qui suit un code (même ligne, sinon ligne suivante). */
function valeurApres(lignes, reCode) {
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(reCode)
    if (!m) continue
    let reste = lignes[i].slice(m.index + m[0].length)
    const coupe = reste.search(RE_CODE_SUIVANT)
    if (coupe >= 0) reste = reste.slice(0, coupe)
    let v = nettoyer(reste)
    if (!v && lignes[i + 1] && !/^\s*[A-Z]\s?[.,]\s?\d?/.test(lignes[i + 1])) {
      const suivante = lignes[i + 1]
      const c = suivante.search(RE_CODE_SUIVANT)
      v = nettoyer(c >= 0 ? suivante.slice(0, c) : suivante)
    }
    if (v) return v
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
  return chiffres >= 3 && chiffres < 17 ? vin : ''
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

/** Extrait les champs utiles du texte brut lu sur la carte grise. */
export function analyserTexteCarteGrise(texteBrut) {
  const texte = (texteBrut || '').toUpperCase().replace(/[‘’`´]/g, "'")
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

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

  const champs = {
    plaque: plaqueDe(texte),
    date_1re_immat: date,
    marque: valeurApres(lignes, new RegExp(`${D}${UN}\\b\\.?`)),
    modele: valeurApres(lignes, new RegExp(`${D}3\\b\\.?`)),
    vin: vinDe(lignes),
    type_mine: cnit(valeurApres(lignes, new RegExp(`${D}2\\s?[.,]?\\s?${UN}\\b\\.?`))),
  }
  return Object.fromEntries(Object.entries(champs).filter(([, v]) => v))
}

/** Prépare la photo pour l'OCR : taille raisonnable, niveaux de gris, contraste renforcé. */
async function preparer(fichier) {
  try {
    const bitmap = await createImageBitmap(fichier)
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    const ctx = canvas.getContext('2d')
    ctx.filter = 'grayscale(1) contrast(1.4)'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch {
    return fichier
  }
}

/**
 * Lit une photo de carte grise. onProgres(0..1) suit l'avancement.
 * Le moteur (quelques Mo) n'est chargé qu'au premier scan, puis reste en cache.
 */
export async function lireCarteGrise(fichier, onProgres = () => {}) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgres(0.2 + 0.8 * m.progress)
      else if (typeof m.progress === 'number') onProgres(0.2 * m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(await preparer(fichier))
    return analyserTexteCarteGrise(data.text)
  } finally {
    await worker.terminate()
  }
}
