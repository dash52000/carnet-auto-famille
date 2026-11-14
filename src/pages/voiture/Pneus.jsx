import { useState } from 'react'
import { supabase, q } from '../../lib/supabase.js'
import { ETATS_PNEU, SAISONS, lienPneus } from '../../lib/constantes.js'
import { aujourdhui, fmtDate } from '../../lib/format.js'
import { saisonCible } from '../../lib/echeances.js'
import { Bouton, Carte, Champ, Choix, Erreur, Input, Titre } from '../../components/ui.jsx'

export default function Pneus({ voiture: v, jeux, recharger }) {
  const [erreur, setErreur] = useState(null)
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

  const majJeu = (jeu, champs) => action(() => q(supabase.from('tyre_sets').update(champs).eq('id', jeu.id)))
  const supprimerJeu = (jeu) =>
    confirm('Supprimer ce jeu de pneus ?') && action(() => q(supabase.from('tyre_sets').delete().eq('id', jeu.id)))

  const monte = jeux.find((j) => j.statut === 'monte')
  const auBox = jeux.find((j) => j.statut === 'box')

  async function changerSaison() {
    const emplacement = prompt('Emplacement dans le box pour les pneus démontés ?', auBox?.emplacement_box ?? '')
    if (emplacement === null) return
    await action(async () => {
      await q(supabase.from('tyre_sets').update({ statut: 'box', emplacement_box: emplacement || null, date_depot: aujourdhui() }).eq('id', monte.id))
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
  }

  return (
    <div className="space-y-5">
      <Erreur message={erreur} />
      <Carte className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Dimension</p>
          <p className="font-mono text-lg font-semibold">{v.dimension_pneus || '— (à renseigner dans Modifier)'}</p>
        </div>
        {v.dimension_pneus && (
          <a href={lienPneus(v.dimension_pneus)} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white">
            Acheter
          </a>
        )}
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
        <Titre action={<button className="text-sm font-medium text-sky-600" onClick={() => setAjout(!ajout)}>+ Jeu de pneus</button>}>
          Jeux de pneus
        </Titre>
        {ajout && <NouveauJeu vehiculeId={v.id} aUnMonte={Boolean(monte)} onFin={() => { setAjout(false); recharger() }} />}
        <div className="space-y-3">
          {jeux.length === 0 && !ajout && <Carte className="text-sm text-slate-500">Aucun jeu renseigné.</Carte>}
          {jeux.map((j) => (
            <Carte key={j.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {SAISONS[j.saison]} {j.marque && <span className="font-normal text-slate-500">· {j.marque}</span>}
                </p>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${j.statut === 'monte' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {j.statut === 'monte' ? 'Monté' : `Au box${j.emplacement_box ? ' · ' + j.emplacement_box : ''}`}
                </span>
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
              <div className="flex justify-between text-sm">
                <button
                  className="text-sky-600"
                  onClick={() =>
                    j.statut === 'monte'
                      ? majJeu(j, { statut: 'box', date_depot: aujourdhui() })
                      : majJeu(j, { statut: 'monte', emplacement_box: null, date_depot: null })
                  }
                >
                  {j.statut === 'monte' ? 'Mettre au box' : 'Marquer comme monté'}
                </button>
                {j.statut === 'box' && (
                  <button
                    className="text-sky-600"
                    onClick={() => {
                      const emp = prompt('Emplacement dans le box ?', j.emplacement_box ?? '')
                      if (emp !== null) majJeu(j, { emplacement_box: emp || null })
                    }}
                  >
                    Emplacement
                  </button>
                )}
                <button className="text-slate-400" onClick={() => supprimerJeu(j)}>
                  Supprimer
                </button>
              </div>
              {j.date_depot && <p className="text-xs text-slate-500">Déposé le {fmtDate(j.date_depot)}</p>}
            </Carte>
          ))}
        </div>
      </section>
    </div>
  )
}

function NouveauJeu({ vehiculeId, aUnMonte, onFin }) {
  const [saison, setSaison] = useState('ete')
  const [marque, setMarque] = useState('')
  const [statut, setStatut] = useState(aUnMonte ? 'box' : 'monte')
  const [erreur, setErreur] = useState(null)

  async function enregistrer(e) {
    e.preventDefault()
    const { error } = await supabase.from('tyre_sets').insert({
      vehicle_id: vehiculeId,
      saison,
      marque: marque || null,
      statut,
      date_depot: statut === 'box' ? aujourdhui() : null,
    })
    if (error) setErreur(error.message)
    else onFin()
  }

  return (
    <Carte className="mb-3 space-y-3">
      <form onSubmit={enregistrer} className="space-y-3">
        <Choix options={Object.entries(SAISONS).map(([code, label]) => ({ code, label }))} valeur={saison} onChange={setSaison} />
        <Champ label="Marque (facultatif)">
          <Input value={marque} onChange={(e) => setMarque(e.target.value)} />
        </Champ>
        <Choix options={[{ code: 'monte', label: 'Monté' }, { code: 'box', label: 'Au box' }]} valeur={statut} onChange={setStatut} />
        <Bouton className="w-full">Ajouter</Bouton>
        <Erreur message={erreur} />
      </form>
    </Carte>
  )
}
