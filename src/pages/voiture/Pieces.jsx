import { useState } from 'react'
import { supabase, q } from '../../lib/supabase.js'
import { CATEGORIES_PIECES, MARCHANDS, lienPneus } from '../../lib/constantes.js'
import { fmtDate } from '../../lib/format.js'
import { Bouton, Carte, Erreur, Input } from '../../components/ui.jsx'
import { Copier } from './Resume.jsx'

const cle = (categorie, position) => `${categorie}|${position ?? ''}`

const SITES = [
  { nom: 'Oscaro', url: 'https://www.oscaro.com/' },
  { nom: 'Norauto', url: 'https://www.norauto.fr/' },
]

export default function Pieces({ voiture: v, pieces, recharger }) {
  const [edition, setEdition] = useState(null) // clé de la ligne en cours d'édition
  const [choix, setChoix] = useState(false) // grille « quelle pièce ? »
  const [autre, setAutre] = useState('')
  const [copie, setCopie] = useState(false)
  const [erreur, setErreur] = useState(null)

  const parCle = Object.fromEntries(pieces.map((p) => [cle(p.categorie, p.position), p]))
  const libelle = (p) =>
    CATEGORIES_PIECES.find((c) => cle(c.categorie, c.position) === cle(p.categorie, p.position))?.label ?? p.categorie
  // on n'affiche que ce qu'on connaît : la fiche se remplit au fil des interventions
  const connues = pieces
    .filter((p) => p.reference || p.marque)
    .map((p) => ({ categorie: p.categorie, position: p.position, label: libelle(p) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const manquantes = CATEGORIES_PIECES.filter((c) => !connues.some((k) => cle(k.categorie, k.position) === cle(c.categorie, c.position)))

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

  function chercher(site) {
    navigator.clipboard?.writeText(v.plaque).catch(() => {})
    setCopie(true)
    window.open(site.url, '_blank', 'noreferrer')
  }

  const ligneEditee =
    edition &&
    !connues.some((l) => cle(l.categorie, l.position) === edition) &&
    (CATEGORIES_PIECES.find((c) => cle(c.categorie, c.position) === edition) ?? {
      categorie: edition.split('|')[0],
      position: null,
      label: edition.split('|')[0],
    })

  return (
    <div className="space-y-4">
      <Carte className="space-y-3">
        <p className="font-medium">Trouver les bonnes pièces</p>
        <div className="flex gap-2">
          {SITES.map((s) => (
            <button key={s.nom} onClick={() => chercher(s)} className="flex-1 rounded-xl bg-slate-900 py-3 font-medium text-white active:bg-slate-700">
              🔎 {s.nom}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {copie ? (
            <span className="text-emerald-700">✓ Plaque {v.plaque} copiée : colle-la dans la recherche du site.</span>
          ) : (
            <>Le bouton copie la plaque : il n'y a plus qu'à la coller sur le site.</>
          )}
        </p>
        {(v.type_mine || v.vin) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">La plaque n'est pas reconnue ?</summary>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Type mine</span>
                <Copier valeur={v.type_mine} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VIN</span>
                <Copier valeur={v.vin} />
              </div>
            </div>
          </details>
        )}
      </Carte>

      <Erreur message={erreur} />

      {ligneEditee && (
        <Carte className="overflow-hidden p-0">
          <FormPiece ligne={ligneEditee} piece={parCle[edition]} onAnnuler={() => setEdition(null)} onValider={enregistrer} />
        </Carte>
      )}

      {connues.length > 0 || v.dimension_pneus ? (
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
          {connues.map((ligne) => {
            const k = cle(ligne.categorie, ligne.position)
            return edition === k ? (
              <FormPiece key={k} ligne={ligne} piece={parCle[k]} onAnnuler={() => setEdition(null)} onValider={enregistrer} />
            ) : (
              <LignePiece key={k} ligne={ligne} piece={parCle[k]} onEditer={() => setEdition(k)} />
            )
          })}
        </Carte>
      ) : (
        !ligneEditee && (
          <Carte className="text-sm text-slate-600">
            Pas encore de référence. Pas besoin de tout remplir maintenant : quand tu saisis une intervention (plaquettes,
            batterie, filtres…), note la réf. inscrite sur la boîte et elle s'ajoute ici toute seule.
          </Carte>
        )
      )}

      {!choix ? (
        <Bouton variante="secondaire" className="w-full" onClick={() => setChoix(true)}>
          + Ajouter une référence
        </Bouton>
      ) : (
        <Carte className="space-y-3">
          <p className="font-medium">Quelle pièce ?</p>
          <div className="flex flex-wrap gap-2">
            {manquantes.map((c) => (
              <button
                key={cle(c.categorie, c.position)}
                onClick={() => {
                  setEdition(cle(c.categorie, c.position))
                  setChoix(false)
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                {c.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!autre.trim()) return
              setEdition(cle(autre.trim().toLowerCase(), null))
              setAutre('')
              setChoix(false)
            }}
          >
            <Input placeholder="Autre (ex. bougies)" value={autre} onChange={(e) => setAutre(e.target.value)} />
            <Bouton variante="secondaire">OK</Bouton>
          </form>
          <button className="text-sm text-slate-500" onClick={() => setChoix(false)}>
            Fermer
          </button>
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
          {piece.event_id ? 'Retenu lors d’une intervention' : piece.source === 'facture' ? 'Lu sur une facture' : 'Saisi à la main'} · {fmtDate(piece.date_maj)}
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
