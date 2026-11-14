import { useState } from 'react'
import { dernierMoteur, lireTexte } from '../lib/ocr.js'

/**
 * Bouton « photo ou PDF d'un papier » : lit le document, appelle analyser(texte) puis onLu(fichier, champs).
 * Affiche la progression, puis combien d'infos ont été trouvées.
 */
export default function LecturePapier({ label, aide, analyser, onLu, attendus = 3 }) {
  const [progres, setProgres] = useState(null)
  const [message, setMessage] = useState(null)
  const [nom, setNom] = useState(null)

  async function choisi(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setNom(fichier.name)
    setMessage(null)
    setProgres(0)
    let champs = {}
    let echec = false
    try {
      champs = analyser(await lireTexte(fichier, setProgres))
    } catch {
      echec = true
    }
    setProgres(null)
    const n = Object.keys(champs).filter((k) => !['contre_visite', 'date_limite'].includes(k)).length
    if (echec) setMessage({ ok: false, texte: 'Lecture impossible (pas de réseau au premier usage ?) : document joint, complète à la main.' })
    else if (n >= attendus) setMessage({ ok: true, texte: `${n} infos lues : vérifie-les (en vert).` })
    else if (n > 0) setMessage({ ok: false, texte: `${n} info${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''} (en vert) : complète le reste.` })
    else setMessage({ ok: false, texte: 'Rien de lisible : document joint, complète à la main (ou reprends une photo bien à plat).' })
    onLu(fichier, champs)
  }

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 px-4 py-3 active:bg-slate-100">
        <span className="text-2xl">📷</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{nom ? `📎 ${nom}` : label}</span>
          <span className="block text-xs text-slate-500">{nom ? 'Toucher pour changer' : aide}</span>
        </span>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={choisi} disabled={progres != null} />
      </label>
      {progres != null && (
        <div className="space-y-1">
          <p className="text-sm text-slate-600">Lecture… {Math.round(progres * 100)} %</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${Math.round(progres * 100)}%` }} />
          </div>
        </div>
      )}
      {message && (
        <p className={`rounded-xl p-2 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          {message.ok ? '✓ ' : ''}
          {message.texte}
          {dernierMoteur && <span className="block text-xs opacity-60">Lu avec {dernierMoteur}</span>}
        </p>
      )}
    </div>
  )
}

/** Classe à ajouter à un champ pré-rempli par la lecture. */
export const classeLu = (lus, champ) => (lus?.[champ] ? 'border-emerald-500 bg-emerald-50' : '')
