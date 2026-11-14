export const aujourdhui = () => new Date().toISOString().slice(0, 10)

export function fmtDate(d) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T12:00:00' : d) : d
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const fmtKm = (km) => (km == null ? '—' : `${Number(km).toLocaleString('fr-FR')} km`)

export const fmtEuros = (v) =>
  v == null ? '' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Nombre de jours entre aujourd'hui et une date (négatif = passé). */
export function joursAvant(d) {
  if (!d) return null
  const cible = new Date((typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)) + 'T12:00:00')
  const now = new Date(aujourdhui() + 'T12:00:00')
  return Math.round((cible - now) / 86400000)
}

export function ajouterMois(d, mois) {
  const date = new Date(d.slice(0, 10) + 'T12:00:00')
  date.setMonth(date.getMonth() + mois)
  return date.toISOString().slice(0, 10)
}

export function ajouterJours(d, jours) {
  const date = new Date(d.slice(0, 10) + 'T12:00:00')
  date.setDate(date.getDate() + jours)
  return date.toISOString().slice(0, 10)
}

export function dansXJours(n) {
  if (n == null) return ''
  if (n === 0) return "aujourd'hui"
  if (n === 1) return 'demain'
  if (n === -1) return 'hier'
  if (n < 0) return `il y a ${-n} j`
  if (n > 60) return `dans ${Math.round(n / 30)} mois`
  return `dans ${n} j`
}

/** Met une plaque au format AB-123-CD si possible. */
export function normaliserPlaque(p) {
  const brut = (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = brut.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (p || '').toUpperCase().trim()
}

export const nomPersonne = (profil) => profil?.prenom || profil?.email?.split('@')[0] || 'Quelqu’un'

/** Date d'il y a n mois (ISO). */
export function ilYa(mois) {
  const d = new Date(aujourdhui() + 'T12:00:00')
  d.setMonth(d.getMonth() - mois)
  return d.toISOString().slice(0, 10)
}

/** « ~ mars 2025 » pour une date approximative, sinon la date exacte. */
export function fmtDateApprox(d, approx) {
  if (!d || !approx) return fmtDate(d)
  return '~ ' + new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export const fmtKmApprox = (km, approx) => (km == null ? '—' : `${approx ? '~' : ''}${fmtKm(km)}`)
