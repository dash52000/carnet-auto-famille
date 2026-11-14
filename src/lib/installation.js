// Installation de l'app sur l'écran d'accueil (voir specs 3.17).

/** Ouverte depuis l'icône de l'écran d'accueil ? */
export function estStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function estIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Android / Chrome : le navigateur propose lui-même l'installation, on garde l'invitation pour notre bouton
let invitation = null
const abonnes = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    invitation = e
    abonnes.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    invitation = null
    abonnes.forEach((f) => f())
  })
}

export const installationNative = () => Boolean(invitation)
export function surChangement(f) {
  abonnes.add(f)
  return () => abonnes.delete(f)
}
export async function installer() {
  if (!invitation) return false
  invitation.prompt()
  const { outcome } = await invitation.userChoice
  invitation = null
  abonnes.forEach((f) => f())
  return outcome === 'accepted'
}

// Le code famille est aussi gardé dans un cookie : sur iPhone, l'app installée ne voit pas le
// stockage de Safari, mais elle reçoit ses cookies (iOS 17.2 et plus). Le code est donc déjà rempli.
const COOKIE = 'carnet-code'
export function memoriserCode(code) {
  if (!code) return
  try {
    localStorage.setItem('carnet-auto-code', code)
  } catch {
    /* navigation privée */
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; max-age=31536000; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}
export function lireCode() {
  try {
    const local = localStorage.getItem('carnet-auto-code')
    if (local) return local
  } catch {
    /* navigation privée */
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

const CLE_MASQUEE = 'installation-masquee'
export const invitationMasquee = () => {
  try {
    return localStorage.getItem(CLE_MASQUEE) === '1'
  } catch {
    return false
  }
}
export const masquerInvitation = () => {
  try {
    localStorage.setItem(CLE_MASQUEE, '1')
  } catch {
    /* navigation privée */
  }
}
