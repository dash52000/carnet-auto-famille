import { useState } from 'react'
import { supabase, q } from '../../lib/supabase.js'
import { CATEGORIES_PIECES, MARCHANDS, lienPneus } from '../../lib/constantes.js'
import { fmtDate } from '../../lib/format.js'
import { Bouton, Carte, Erreur, Input } from '../../components/ui.jsx'
import { Copier } from './Resume.jsx'

const cle = (categorie, position) => `${categorie}|${position ?? ''}`

export default function Pieces({ voiture: v, pieces, recharger }) {
  const [edition, setEdition] = useState(null) // clé de la ligne en cours d'édition
  const [erreur, setErreur] = useState(null)
  const [nouvelle, setNouvelle] = useState('')

  const parCle = Object.fromEntries(pieces.map((p) => [cle(p.categorie, p.position), p]))
  const lignes = [
    ...CATEGORIES_PIECES,
    // pièces ajoutées à la main, hors liste standard
    ...pieces
      .filter((p) => !CATEGORIES_PIECES.some((c) => cle(c.categorie, c.position) === cle(p.categorie, p.position)))
      .map((p) => ({ categorie: p.categorie, position: p.position, label: p.categorie })),
  ]

  async function enregistrer(ligne, reference, marque) {
    setErreur(null)
    const existante = parCle[cle(ligne.categorie, ligne.position)]
    try {
      if (existante) {
        await q(
          supabase
            .from('parts')
            .update({ reference: reference || null, marque: marque || null, source: 'manuel', date_maj: new Date().toISOString() })
            .eq('id', existante.id),
        )
      } else if (reference || marque) {
        await q(
          supabase.from('parts').insert({
            vehicle_id: v.id,
            categorie: ligne.categorie,
            position: ligne.position,
            reference: reference || null,
            marque: marque || null,
          }),
        )
      }
      setEdition(null)
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <Carte className="space-y-2 text-sm">
        <p className="text-slate-600">
          Pour remplir la fiche : recherche la voiture par sa plaque sur un site de pièces, puis recopie les références ici.
          Si la plaque n'est pas reconnue, utilise le type mine ou le VIN.
        </p>
        <div className="flex justify-between">
          <span className="text-slate-500">Plaque</span>
          <Copier valeur={v.plaque} />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Type mine</span>
          <Copier valeur={v.type_mine} />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">VIN</span>
          <Copier valeur={v.vin} />
        </div>
        <div className="flex gap-2 pt-1">
          <a href="https://www.oscaro.com/" target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-slate-100 py-2 text-center font-medium">
            Ouvrir Oscaro
          </a>
          <a href="https://www.norauto.fr/" target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-slate-100 py-2 text-center font-medium">
            Ouvrir Norauto
          </a>
        </div>
      </Carte>

      <Erreur message={erreur} />

      <Carte className="divide-y divide-slate-100 p-0">
        {v.dimension_pneus && (
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">Pneus</p>
              <p className="font-mono text-sm">{v.dimension_pneus}</p>
            </div>
            <a href={lienPneus(v.dimension_pneus)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-600">
              Acheter
            </a>
          </div>
        )}
        {lignes.map((ligne) => {
          const k = cle(ligne.categorie, ligne.position)
          const piece = parCle[k]
          return edition === k ? (
            <FormPiece key={k} ligne={ligne} piece={piece} onAnnuler={() => setEdition(null)} onValider={enregistrer} />
          ) : (
            <LignePiece key={k} ligne={ligne} piece={piece} onEditer={() => setEdition(k)} />
          )
        })}
      </Carte>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!nouvelle.trim()) return
          setEdition(cle(nouvelle.trim(), null))
          setNouvelle('')
        }}
      >
        <Input placeholder="Autre pièce (ex. bougies)" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} />
        <Bouton variante="secondaire">Ajouter</Bouton>
      </form>
      {edition && !lignes.some((l) => cle(l.categorie, l.position) === edition) && (
        <Carte className="p-0">
          <FormPiece
            ligne={{ categorie: edition.split('|')[0], position: null, label: edition.split('|')[0] }}
            onAnnuler={() => setEdition(null)}
            onValider={enregistrer}
          />
        </Carte>
      )}
    </div>
  )
}

function LignePiece({ ligne, piece, onEditer }) {
  const [menu, setMenu] = useState(false)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onEditer} className="min-w-0 flex-1 text-left">
          <p className="font-medium">{ligne.label}</p>
          {piece?.reference || piece?.marque ? (
            <p className="truncate text-sm">
              <span className="font-mono">{piece.reference}</span> {piece.marque && <span className="text-slate-500">· {piece.marque}</span>}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Toucher pour renseigner</p>
          )}
        </button>
        {piece?.reference && (
          <button onClick={() => setMenu(!menu)} className="shrink-0 text-sm font-semibold text-sky-600">
            Acheter
          </button>
        )}
      </div>
      {menu && (
        <div className="mt-2 flex flex-wrap gap-2">
          {MARCHANDS.map((m) => (
            <a key={m.nom} href={m.url(piece.reference)} target="_blank" rel="noreferrer" className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-700">
              {m.nom}
            </a>
          ))}
        </div>
      )}
      {piece && (
        <p className="mt-1 text-xs text-slate-400">
          {piece.source === 'facture' ? 'Lu sur une facture' : 'Saisi à la main'} · {fmtDate(piece.date_maj)}
        </p>
      )}
    </div>
  )
}

function FormPiece({ ligne, piece, onAnnuler, onValider }) {
  const [reference, setReference] = useState(piece?.reference ?? '')
  const [marque, setMarque] = useState(piece?.marque ?? '')
  return (
    <form
      className="space-y-2 bg-sky-50 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        onValider(ligne, reference.trim(), marque.trim())
      }}
    >
      <p className="font-medium">{ligne.label}</p>
      <Input autoFocus placeholder="Référence" value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" />
      <Input placeholder="Marque (Bosch, Valeo…)" value={marque} onChange={(e) => setMarque(e.target.value)} />
      <div className="flex gap-2">
        <Bouton type="button" variante="secondaire" className="flex-1" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton className="flex-1">Enregistrer</Bouton>
      </div>
    </form>
  )
}
