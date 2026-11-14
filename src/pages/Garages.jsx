import { useState } from 'react'
import { supabase, q } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { LIBELLE_TYPE } from '../lib/constantes.js'
import { fmtDate, fmtEuros } from '../lib/format.js'
import { Bouton, Carte, Champ, Chargement, Erreur, Input, Titre, useCharger } from '../components/ui.jsx'

async function charger() {
  const [garages, events] = await Promise.all([
    q(supabase.from('garages').select('*').order('nom')),
    q(
      supabase
        .from('events')
        .select('id, garage_id, type, libelle, date, cout, voiture:vehicles(plaque)')
        .not('garage_id', 'is', null)
        .order('date', { ascending: false }),
    ),
  ])
  return garages.map((g) => {
    const ev = events.filter((e) => e.garage_id === g.id)
    return { ...g, events: ev, total: ev.reduce((s, e) => s + Number(e.cout || 0), 0) }
  })
}

export default function Garages() {
  const { profil } = useAuth()
  const { data, erreur, chargement, recharger } = useCharger(charger)
  const [form, setForm] = useState(null) // null | {} (nouveau) | garage (édition)
  const [ouvert, setOuvert] = useState(null)
  const [err, setErr] = useState(null)

  async function supprimer(g) {
    if (!confirm(`Supprimer ${g.nom} ? Les interventions resteront, sans garage.`)) return
    try {
      await q(supabase.from('garages').delete().eq('id', g.id))
      recharger()
    } catch (e) {
      setErr(e.message)
    }
  }

  if (chargement) return <Chargement />

  return (
    <div>
      <Titre action={<button className="text-sm font-medium text-sky-600" onClick={() => setForm({})}>+ Garage</button>}>
        Garages
      </Titre>
      <Erreur message={erreur || err} />
      {form && (
        <FormGarage
          garage={form}
          onFin={() => {
            setForm(null)
            recharger()
          }}
        />
      )}
      {data?.length === 0 && !form && <Carte className="text-sm text-slate-500">Aucun garage enregistré.</Carte>}
      <div className="space-y-3">
        {data?.map((g) => (
          <Carte key={g.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOuvert(ouvert === g.id ? null : g.id)}>
                <p className="font-semibold">{g.nom}</p>
                {g.adresse && <p className="text-sm text-slate-500">{g.adresse}</p>}
                <p className="text-sm text-slate-500">
                  {g.events.length} intervention{g.events.length > 1 ? 's' : ''} · {fmtEuros(g.total) || '0 €'}
                </p>
              </button>
              {g.telephone && (
                <a href={`tel:${g.telephone}`} className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                  📞 Appeler
                </a>
              )}
            </div>
            {ouvert === g.id && (
              <div className="space-y-2 border-t border-slate-100 pt-2">
                {g.events.map((e) => (
                  <p key={e.id} className="text-sm">
                    {fmtDate(e.date)} · <span className="font-mono">{e.voiture?.plaque}</span> ·{' '}
                    {e.type === 'autre' ? e.libelle : LIBELLE_TYPE[e.type]} {e.cout != null && `· ${fmtEuros(e.cout)}`}
                  </p>
                ))}
                <div className="flex gap-4 text-sm">
                  <button className="text-sky-600" onClick={() => setForm(g)}>
                    Modifier
                  </button>
                  {(profil.est_admin || g.cree_par === profil.id) && (
                    <button className="text-slate-400" onClick={() => supprimer(g)}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )}
          </Carte>
        ))}
      </div>
    </div>
  )
}

function FormGarage({ garage, onFin }) {
  const [g, setG] = useState({ nom: garage.nom ?? '', telephone: garage.telephone ?? '', adresse: garage.adresse ?? '' })
  const [erreur, setErreur] = useState(null)

  async function enregistrer(e) {
    e.preventDefault()
    const champs = { nom: g.nom.trim(), telephone: g.telephone.trim() || null, adresse: g.adresse.trim() || null }
    const { error } = garage.id
      ? await supabase.from('garages').update(champs).eq('id', garage.id)
      : await supabase.from('garages').insert(champs)
    if (error) setErreur(error.message)
    else onFin()
  }

  return (
    <Carte className="mb-3">
      <form onSubmit={enregistrer} className="space-y-3">
        <Champ label="Nom">
          <Input required value={g.nom} onChange={(e) => setG({ ...g, nom: e.target.value })} />
        </Champ>
        <Champ label="Téléphone">
          <Input type="tel" value={g.telephone} onChange={(e) => setG({ ...g, telephone: e.target.value })} />
        </Champ>
        <Champ label="Adresse">
          <Input value={g.adresse} onChange={(e) => setG({ ...g, adresse: e.target.value })} />
        </Champ>
        <div className="flex gap-2">
          <Bouton type="button" variante="secondaire" className="flex-1" onClick={onFin}>
            Annuler
          </Bouton>
          <Bouton className="flex-1">Enregistrer</Bouton>
        </div>
        <Erreur message={erreur} />
      </form>
    </Carte>
  )
}
