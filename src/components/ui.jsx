import { useCallback, useEffect, useState } from 'react'
import { COULEUR_STATUT } from '../lib/echeances.js'

/** Charge des données de façon asynchrone. */
export function useCharger(fonction, deps = []) {
  const [etat, setEtat] = useState({ data: null, erreur: null, chargement: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const charger = useCallback(fonction, deps)
  const recharger = useCallback(async () => {
    try {
      const data = await charger()
      setEtat({ data, erreur: null, chargement: false })
    } catch (e) {
      setEtat((s) => ({ ...s, erreur: e.message, chargement: false }))
    }
  }, [charger])
  useEffect(() => {
    recharger()
  }, [recharger])
  return { ...etat, recharger }
}

export function Bouton({ variante = 'principal', className = '', ...props }) {
  const styles = {
    principal: 'bg-slate-900 text-white active:bg-slate-700',
    secondaire: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
    danger: 'bg-red-600 text-white active:bg-red-700',
    discret: 'text-slate-600 underline',
  }
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-3 font-medium disabled:opacity-50 ${styles[variante]} ${className}`}
    />
  )
}

export function Champ({ label, aide, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {aide && <span className="mt-1 block text-xs text-slate-500">{aide}</span>}
    </label>
  )
}

export const classeInput =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-900'

export function Input(props) {
  return <input {...props} className={`${classeInput} ${props.className ?? ''}`} />
}

export function Carte({ className = '', ...props }) {
  return <div {...props} className={`rounded-2xl bg-white p-4 shadow-sm ${className}`} />
}

export function Pastille({ statut, className = '' }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${COULEUR_STATUT[statut]} ${className}`} />
}

export function Chargement() {
  return <p className="p-6 text-center text-slate-500">Chargement…</p>
}

export function Erreur({ message }) {
  if (!message) return null
  return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>
}

export function Titre({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  )
}

export function Onglets({ onglets, actif, onChange }) {
  return (
    <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
      {onglets.map((o) => (
        <button
          key={o.code}
          onClick={() => onChange(o.code)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
            actif === o.code ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 shadow-sm'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Sélecteur de choix en boutons (plus rapide qu'une liste déroulante au doigt). */
export function Choix({ options, valeur, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.code}
          onClick={() => onChange(o.code)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            valeur === o.code ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
