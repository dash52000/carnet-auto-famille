import { useEffect, useRef, useState } from 'react'
import { ETATS_PNEU } from '../lib/constantes.js'
import { POSITIONS_PNEU, etatDuPct, etatGlobal, usureDuJeu } from '../lib/pneus.js'

const REMPLISSAGE = { neuf: 'fill-emerald-500', mi_use: 'fill-amber-500', a_changer: 'fill-red-500', inconnu: 'fill-slate-400' }
const COURT = { neuf: 'Neuf', mi_use: 'Mi-usé', a_changer: 'À chang.', inconnu: '?' }

// Vue de dessus : avant en haut. x = coin gauche du pneu, xt = position du texte à côté.
const GEOMETRIE = {
  av_g: { x: 47, y: 50, xt: 41, ancre: 'end' },
  av_d: { x: 155, y: 50, xt: 179, ancre: 'start' },
  ar_g: { x: 47, y: 160, xt: 41, ancre: 'end' },
  ar_d: { x: 155, y: 160, xt: 179, ancre: 'start' },
}

function texteDuPneu(p) {
  return p.pct != null ? `${p.pct} %` : COURT[p.etat]
}

/**
 * Les 4 pneus d'un jeu, dessinés et cliquables. Toucher un pneu ouvre un mini-choix
 * (état en 1 tap, usure en % facultative) ; « Les 4 pareils » recopie sur tout le jeu.
 * onChange(usure, etat) reçoit les 4 pneus et l'état global (le pire des 4).
 */
export default function SchemaPneus({ jeu, onChange }) {
  const [usure, setUsure] = useState(() => usureDuJeu(jeu))
  const [choisi, setChoisi] = useState(null)
  const [voirPct, setVoirPct] = useState(false)
  const minuteur = useRef(null)

  // resynchronise après rechargement (sauf pendant qu'on fait glisser le curseur)
  useEffect(() => {
    if (!minuteur.current) setUsure(usureDuJeu(jeu))
  }, [jeu])
  useEffect(() => () => clearTimeout(minuteur.current), [])

  function enregistrer(nouvelle, differe = false) {
    setUsure(nouvelle)
    clearTimeout(minuteur.current)
    const envoyer = () => {
      minuteur.current = null
      onChange(nouvelle, etatGlobal(nouvelle))
    }
    if (differe) minuteur.current = setTimeout(envoyer, 600)
    else envoyer()
  }

  const majPneu = (code, valeur, differe) => enregistrer({ ...usure, [code]: valeur }, differe)
  const lesQuatre = (valeur) => enregistrer(Object.fromEntries(POSITIONS_PNEU.map(({ code }) => [code, { ...valeur }])))

  function toucher(code) {
    setChoisi(choisi === code ? null : code)
    setVoirPct(false)
  }

  const p = choisi && usure[choisi]
  const position = choisi && POSITIONS_PNEU.find((x) => x.code === choisi)

  return (
    <div className="space-y-3">
      <svg viewBox="-20 0 260 250" className="mx-auto block h-56 w-auto select-none" role="group" aria-label="Usure des 4 pneus">
        <text x="110" y="12" textAnchor="middle" className="fill-slate-400 text-[10px]">
          ▲ Avant
        </text>
        {/* carrosserie */}
        <rect x="60" y="22" width="100" height="216" rx="34" className="fill-slate-100 stroke-slate-300" strokeWidth="2" />
        <path d="M74 82 Q110 66 146 82 L140 104 Q110 94 80 104 Z" className="fill-sky-100 stroke-slate-300" />
        <path d="M80 190 Q110 198 140 190 L144 208 Q110 220 76 208 Z" className="fill-sky-100 stroke-slate-300" />
        <rect x="80" y="108" width="60" height="78" rx="10" className="fill-slate-200" />

        {POSITIONS_PNEU.map(({ code, label }) => {
          const g = GEOMETRIE[code]
          const pneu = usure[code]
          const actif = choisi === code
          return (
            <g key={code} onClick={() => toucher(code)} className="cursor-pointer" role="button" aria-label={`${label} : ${texteDuPneu(pneu)}`}>
              {/* zone de toucher plus large que le pneu */}
              <rect x={g.x - 40} y={g.y - 12} width="98" height="70" className="fill-transparent" />
              <rect
                x={g.x}
                y={g.y}
                width="18"
                height="46"
                rx="6"
                className={`${REMPLISSAGE[pneu.etat]} ${actif ? 'stroke-slate-900' : 'stroke-white'}`}
                strokeWidth={actif ? 3 : 1.5}
              />
              <text x={g.xt} y={g.y + 27} textAnchor={g.ancre} className={`text-[11px] font-semibold ${actif ? 'fill-slate-900' : 'fill-slate-600'}`}>
                {texteDuPneu(pneu)}
              </text>
            </g>
          )
        })}
      </svg>

      {!choisi ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-slate-500">Touche un pneu, ou règle les 4 d'un coup :</p>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            {ETATS_PNEU.map((e) => (
              <button
                key={e.code}
                onClick={() => lesQuatre({ etat: e.code })}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  Object.values(usure).every((x) => x.etat === e.code) ? `${e.couleur} text-white` : 'bg-slate-100 text-slate-600'
                }`}
                title={e.code === 'inconnu' ? 'Je ne sais pas' : undefined}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">{position.label}</p>
            <button onClick={() => setChoisi(null)} className="text-sm text-slate-500">
              Fermer ✕
            </button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            {ETATS_PNEU.map((e) => (
              <button
                key={e.code}
                onClick={() => majPneu(choisi, { etat: e.code })}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${p.etat === e.code ? `${e.couleur} text-white` : 'bg-white text-slate-600'}`}
                title={e.code === 'inconnu' ? 'Je ne sais pas' : undefined}
              >
                {e.label}
              </button>
            ))}
          </div>

          {p.pct != null || voirPct ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Usure estimée : <b>{p.pct ?? 0} %</b>
                </span>
                <button onClick={() => (setVoirPct(false), majPneu(choisi, { etat: p.etat }))} className="text-xs text-slate-500">
                  Effacer le %
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={p.pct ?? 0}
                onChange={(e) => {
                  const pct = Number(e.target.value)
                  majPneu(choisi, { etat: etatDuPct(pct), pct }, true)
                }}
                className="w-full accent-slate-900"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>neuf</span>
                <span>mi-usé (30 %)</span>
                <span>à changer (70 %)</span>
              </div>
            </div>
          ) : (
            <button onClick={() => setVoirPct(true)} className="text-sm font-medium text-sky-600">
              Préciser en % (facultatif)
            </button>
          )}

          <button onClick={() => lesQuatre(p)} className="w-full rounded-xl bg-white py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 active:bg-slate-100">
            Les 4 pareils ({texteDuPneu(p)})
          </button>
        </div>
      )}
    </div>
  )
}
