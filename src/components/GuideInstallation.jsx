import { useEffect, useState } from 'react'
import { estIOS, installationNative, installer, surChangement } from '../lib/installation.js'

/** Icône « Partager » de Safari (carré avec une flèche vers le haut). */
function IconePartager() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-6 w-6 align-[-5px] text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partager">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" />
    </svg>
  )
}

function IconeAjouter() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-6 w-6 align-[-5px] text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="Ajouter">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function Etape({ n, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}

/** Pas-à-pas d'installation sur l'écran d'accueil, selon le téléphone. */
export default function GuideInstallation() {
  const [natif, setNatif] = useState(installationNative())
  useEffect(() => surChangement(() => setNatif(installationNative())), [])

  if (natif)
    return (
      <button onClick={installer} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white active:bg-slate-700">
        📲 Installer l’app
      </button>
    )

  if (estIOS())
    return (
      <ol className="space-y-3">
        <Etape n={1}>
          Touche <IconePartager /> <b>Partager</b> en bas de l’écran (parfois dans le menu <b>…</b>).
        </Etape>
        <Etape n={2}>
          Fais défiler et choisis <IconeAjouter /> <b>Sur l’écran d’accueil</b>.
        </Etape>
        <Etape n={3}>
          Touche <b>Ajouter</b> en haut à droite.
        </Etape>
        <Etape n={4}>
          Ouvre <b>Carnet auto</b> depuis l’icône sur ton écran d’accueil.
        </Etape>
      </ol>
    )

  return (
    <ol className="space-y-3">
      <Etape n={1}>
        Ouvre le menu <b>⋮</b> du navigateur (en haut à droite).
      </Etape>
      <Etape n={2}>
        Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.
      </Etape>
      <Etape n={3}>
        Ouvre <b>Carnet auto</b> depuis l’icône sur ton écran d’accueil.
      </Etape>
    </ol>
  )
}
