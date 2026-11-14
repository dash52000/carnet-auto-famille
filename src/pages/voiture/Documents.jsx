import { useState } from 'react'
import { supabase, q, BUCKET } from '../../lib/supabase.js'
import { useAuth } from '../../lib/auth.jsx'
import { TYPES_DOCUMENT } from '../../lib/constantes.js'
import { envoyerFichier, lienFichier } from '../../lib/images.js'
import { fmtDate } from '../../lib/format.js'
import { Carte, Choix, Erreur, Titre } from '../../components/ui.jsx'

export default function Documents({ voiture: v, documents, recharger }) {
  const { profil } = useAuth()
  const [type, setType] = useState('carte_grise')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function ajouter(e) {
    const fichier = e.target.files[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    setEnvoi(true)
    try {
      const chemin = await envoyerFichier(v.id, fichier)
      await q(supabase.from('documents').insert({ vehicle_id: v.id, type, fichier_path: chemin, nom: fichier.name }))
      recharger()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnvoi(false)
    }
  }

  async function ouvrir(doc) {
    try {
      window.open(await lienFichier(doc.fichier_path), '_blank')
    } catch (err) {
      setErreur(err.message)
    }
  }

  async function supprimer(doc) {
    if (!confirm('Supprimer ce document ?')) return
    try {
      await q(supabase.from('documents').delete().eq('id', doc.id))
      await supabase.storage.from(BUCKET).remove([doc.fichier_path])
      recharger()
    } catch (err) {
      setErreur(err.message)
    }
  }

  return (
    <div className="space-y-5">
      <Carte className="space-y-3">
        <p className="font-medium">Ajouter un document</p>
        <Choix options={Object.entries(TYPES_DOCUMENT).map(([code, label]) => ({ code, label }))} valeur={type} onChange={setType} />
        <label className="block cursor-pointer rounded-xl bg-slate-900 py-3 text-center font-medium text-white">
          {envoi ? 'Envoi…' : '📷 Photo ou fichier'}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={ajouter} disabled={envoi} />
        </label>
      </Carte>
      <Erreur message={erreur} />

      {Object.entries(TYPES_DOCUMENT).map(([code, label]) => {
        const docs = documents.filter((d) => d.type === code)
        if (!docs.length) return null
        return (
          <section key={code}>
            <Titre>{label}</Titre>
            <Carte className="divide-y divide-slate-100 p-0">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => ouvrir(d)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium text-sky-700">{d.nom || label}</p>
                    <p className="text-xs text-slate-500">{fmtDate(d.created_at)}</p>
                  </button>
                  {(d.auteur_id === profil.id || profil.est_admin) && (
                    <button onClick={() => supprimer(d)} className="text-slate-300" aria-label="Supprimer">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </Carte>
          </section>
        )
      })}
      {documents.length === 0 && <p className="text-center text-sm text-slate-500">Aucun document pour l'instant.</p>}
    </div>
  )
}
