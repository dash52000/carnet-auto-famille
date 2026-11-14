import { useState } from 'react'
import { supabase, q } from '../../lib/supabase.js'
import { ETATS_PNEU, SAISONS, lienPneus } from '../../lib/constantes.js'
import { aujourdhui, fmtDate } from '../../lib/format.js'
import { saisonCible } from '../../lib/echeances.js'
import { Bouton, Carte, Choix, Erreur, Input, Titre } from '../../components/ui.jsx'

const ICONES = { ete: '☀️', hiver: '❄️', '4saisons': '🌤️' }
const classePetitInput = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-slate-900 focus:bg-white'

/** Champ enregistré dès qu'on quitte la saisie (pas de bouton à toucher). */
function ChampAuto({ valeur, placeholder, onEnregistrer, className = '' }) {
  const [texte, setTexte] = useState(valeur ?? '')
  return (
    <input
      value={texte}
      placeholder={placeholder}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => texte.trim() !== (valeur ?? '') && onEnregistrer(texte.trim() || null)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={`${classePetitInput} ${className}`}
    />
  )
}

/** Boutons de saison : un tap = un jeu créé. */
function BoutonsSaison({ saisons, onChoix }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {saisons.map((s) => (
        <button
          key={s}
          onClick={() => onChoix(s)}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium active:bg-slate-100"
        >
          <span className="text-2xl">{ICONES[s]}</span>
          {SAISONS[s]}
        </button>
      ))}
    </div>
  )
}

export default function Pneus({ voiture: v, jeux, recharger }) {
  const [erreur, setErreur] = useState(null)
  const [editionDim, setEditionDim] = useState(!v.dimension_pneus)
  const [dim, setDim] = useState(v.dimension_pneus ?? '')
  const [ajout, setAjout] = useState(false)

  async function action(fn) {
    setErreur(null)
    try {
      await fn()
      recharger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  const majVoiture = (champs) => action(() => q(supabase.from('vehicles').update(champs).eq('id', v.id)))
  const majJeu = (jeu, champs) => action(() => q(supabase.from('tyre_sets').update(champs).eq('id', jeu.id)))
  const supprimerJeu = (jeu) =>
    confirm(`Supprimer le jeu ${SAISONS[jeu.saison]} ?`) && action(() => q(supabase.from('tyre_sets').delete().eq('id', jeu.id)))

  const monte = jeux.find((j) => j.statut === 'monte')
  const auBox = jeux.find((j) => j.statut === 'box')

  // un jeu se crée en 1 tap : monté s'il n'y en a pas encore, sinon au box
  const creerJeu = (saison) =>
    action(async () => {
      const statut = monte ? 'box' : 'monte'
      await q(
        supabase.from('tyre_sets').insert({
          vehicle_id: v.id,
          saison,
          statut,
          etat: 'neuf',
          date_depot: statut === 'box' ? aujourdhui() : null,
        }),
      )
      // été + hiver = la voiture alterne
      if (saison !== '4saisons' && monte && monte.saison !== '4saisons' && monte.saison !== saison && !v.alterne_saisons)
        await q(supabase.from('vehicles').update({ alterne_saisons: true }).eq('id', v.id))
      setAjout(false)
    })

  // 1 tap : les pneus démontés prennent la place au box de ceux qu'on remonte
  const changerSaison = () =>
    action(async () => {
      await q(
        supabase.from('tyre_sets').update({ statut: 'box', emplacement_box: auBox.emplacement_box, date_depot: aujourdhui() }).eq('id', monte.id),
      )
      await q(supabase.from('tyre_sets').update({ statut: 'monte', emplacement_box: null, date_depot: null }).eq('id', auBox.id))
      await q(
        supabase.from('events').insert({
          vehicle_id: v.id,
          type: 'changement_saison',
          km: v.km_actuel,
          libelle: `${SAISONS[monte.saison]} → ${SAISONS[auBox.saison]}`,
        }),
      )
    })

  function enregistrerDim(e) {
    e.preventDefault()
    const propre = dim.toUpperCase().replace(/\s+/g, ' ').trim()
    setEditionDim(false)
    majVoiture({ dimension_pneus: propre || null })
  }

  const autreSaison = monte?.saison === 'ete' ? 'hiver' : 'ete'

  return (
    <div className="space-y-5">
      <Erreur message={erreur} />

      <Carte className="space-y-3">
        {editionDim ? (
          <form onSubmit={enregistrerDim} className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Dimension des pneus</p>
            <div className="flex gap-2">
              <Input value={dim} onChange={(e) => setDim(e.target.value)} placeholder="205/55 R16 91V" className="font-mono uppercase" />
              <Bouton>OK</Bouton>
            </div>
            <p className="text-xs text-slate-500">Inscrite sur le flanc du pneu.</p>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <button onClick={() => setEditionDim(true)} className="text-left">
              <p className="text-sm text-slate-500">Dimension</p>
              <p className="font-mono text-lg font-semibold">
                {v.dimension_pneus} <span className="text-xs font-normal text-sky-600">modifier</span>
              </p>
            </button>
            <a href={lienPneus(v.dimension_pneus)} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white">
              Acheter
            </a>
          </div>
        )}
        <Choix
          options={[
            { code: '4saisons', label: '🌤️ 4 saisons toute l’année' },
            { code: 'alterne', label: '☀️/❄️ Été + hiver' },
          ]}
          valeur={v.alterne_saisons ? 'alterne' : '4saisons'}
          onChange={(c) => majVoiture({ alterne_saisons: c === 'alterne' })}
        />
      </Carte>

      {monte && auBox && (
        <Bouton className="w-full" onClick={changerSaison}>
          🔄 Changement de saison ({SAISONS[monte.saison]} → {SAISONS[auBox.saison]})
        </Bouton>
      )}
      {v.alterne_saisons && monte && monte.saison !== '4saisons' && monte.saison !== saisonCible() && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          C'est la période des pneus {saisonCible() === 'hiver' ? 'hiver' : 'été'}.
        </p>
      )}

      <section>
        <Titre
          action={
            jeux.length > 0 && (
              <button className="text-sm font-medium text-sky-600" onClick={() => setAjout(!ajout)}>
                {ajout ? 'Fermer' : '+ Jeu de pneus'}
              </button>
            )
          }
        >
          Jeux de pneus
        </Titre>

        {jeux.length === 0 && (
          <Carte className="space-y-3">
            <p className="font-medium">Quels pneus sont montés en ce moment ?</p>
            <BoutonsSaison saisons={['ete', 'hiver', '4saisons']} onChoix={creerJeu} />
          </Carte>
        )}

        {ajout && (
          <Carte className="mb-3 space-y-3">
            <p className="font-medium">{monte ? 'Nouveau jeu, rangé au box :' : 'Nouveau jeu, monté :'}</p>
            <BoutonsSaison saisons={['ete', 'hiver', '4saisons']} onChoix={creerJeu} />
          </Carte>
        )}

        <div className="space-y-3">
          {jeux.map((j) => (
            <Carte key={j.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {ICONES[j.saison]} {SAISONS[j.saison]}
                </p>
                <button
                  onClick={() =>
                    j.statut === 'monte'
                      ? majJeu(j, { statut: 'box', date_depot: aujourdhui() })
                      : majJeu(j, { statut: 'monte', emplacement_box: null, date_depot: null })
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium ${j.statut === 'monte' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                  title="Toucher pour changer"
                >
                  {j.statut === 'monte' ? 'Monté ⇄' : 'Au box ⇄'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ETATS_PNEU.map((e) => (
                  <button
                    key={e.code}
                    onClick={() => majJeu(j, { etat: e.code })}
                    className={`rounded-xl py-2 text-sm font-medium ${j.etat === e.code ? `${e.couleur} text-white` : 'bg-slate-100 text-slate-600'}`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              <div className={`grid gap-2 ${j.statut === 'box' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <ChampAuto valeur={j.marque} placeholder="Marque (facultatif)" onEnregistrer={(m) => majJeu(j, { marque: m })} />
                {j.statut === 'box' && (
                  <ChampAuto valeur={j.emplacement_box} placeholder="📍 Emplacement" onEnregistrer={(e) => majJeu(j, { emplacement_box: e })} />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{j.date_depot ? `Au box depuis le ${fmtDate(j.date_depot)}` : ''}</span>
                <button onClick={() => supprimerJeu(j)}>Supprimer</button>
              </div>
            </Carte>
          ))}
        </div>

        {v.alterne_saisons && monte && !auBox && monte.saison !== '4saisons' && !ajout && (
          <Carte className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm">Et les pneus {SAISONS[autreSaison].toLowerCase()} au box ?</p>
            <Bouton variante="secondaire" onClick={() => creerJeu(autreSaison)}>
              {ICONES[autreSaison]} Ajouter
            </Bouton>
          </Carte>
        )}
      </section>
    </div>
  )
}
