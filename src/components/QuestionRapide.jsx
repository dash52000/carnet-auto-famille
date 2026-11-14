import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { chargerGarages } from '../lib/donnees.js'
import { IL_Y_A, SAISONS } from '../lib/constantes.js'
import { aujourdhui, ajouterJours, ilYa, joursAvant, ajouterMois } from '../lib/format.js'
import { saisonCible } from '../lib/echeances.js'
import { passerALaSaison } from '../lib/pneus.js'
import { Carte } from './ui.jsx'

// Une seule question à la fois sur l'accueil, réponse en 1 tap.
// « Je ne sais pas » est une réponse acceptée (on ne redemande plus) ; « plus tard » la repousse d'une semaine.
// Les reports et le « pas aujourd'hui » sont propres à chaque téléphone (localStorage).

const CLE_REPORTS = 'questions-reportees'
const CLE_PAUSE = 'questions-pause-jusqu-au'

const lire = (cle, defaut) => {
  try {
    return JSON.parse(localStorage.getItem(cle)) ?? defaut
  } catch {
    return defaut
  }
}
const ecrire = (cle, valeur) => {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    /* navigation privée : tant pis */
  }
}

const nom = (v) => v.modele || v.marque || v.plaque

/** Questions en attente, de la plus utile (celle qui déclenche une alerte) à la moins utile. */
export function questionsEnAttente(voitures, garages = []) {
  const reports = lire(CLE_REPORTS, {})
  const auj = aujourdhui()
  const liste = []
  const ajouter = (v, cle) => {
    const id = `${v.id}:${cle}`
    if ((v.inconnus ?? []).includes(cle) || (reports[id] && reports[id] > auj)) return
    liste.push({ id, cle, voiture: v })
  }
  const actives = voitures.filter((v) => !v.archivee)
  const enRetard = (v, cle) => v.echeances?.some((e) => e.cle === cle && e.statut === 'retard')
  // pas juste après l'avoir saisie (« ~2 ans » met la révision en retard tout de suite)
  const saisieAncienne = (v, type) => {
    const e = v.events.find((x) => x.type === type)
    return !e || !e.created_at || joursAvant(e.created_at) < -7
  }
  const ordre = [
    // une alerte rouge se règle en 1 tap : « c'est fait ? »
    ['fait_revision', (v) => enRetard(v, 'revision') && saisieAncienne(v, 'revision')],
    ['fait_ct', (v) => enRetard(v, 'ct') && saisieAncienne(v, 'controle_technique')],
    ['fait_assurance', (v) => enRetard(v, 'assurance')],
    // période des pneus été / hiver
    [
      'saison',
      (v) => {
        const monte = v.jeux.find((j) => j.statut === 'monte')
        return v.alterne_saisons && monte && monte.saison !== '4saisons' && monte.saison !== saisonCible()
      },
    ],
    ['km', (v) => v.km_actuel == null],
    ['revision', (v) => !v.events.some((e) => e.type === 'revision')],
    [
      'ct',
      (v) =>
        !v.prochain_ct &&
        !v.events.some((e) => e.type === 'controle_technique') &&
        (!v.date_1re_immat || joursAvant(ajouterMois(v.date_1re_immat, 48)) < 0),
    ],
    ['assurance', (v) => !v.echeance_assurance],
    ['pneus', (v) => !v.dimension_pneus],
    ['jeu_pneus', (v) => v.jeux.length === 0],
    ['garage', (v) => !v.garage_habituel_id && garages.length > 0],
  ]
  for (const [cle, manque] of ordre) for (const v of actives) if (manque(v)) ajouter(v, cle)
  return liste
}

/** Petite ligne dans le fil d'activité (« Maman a renseigné… »). */
const info = (vehiculeId, libelle) => q(supabase.from('events').insert({ vehicle_id: vehiculeId, type: 'info', libelle }))

export default function QuestionRapide({ voitures, recharger }) {
  const navigate = useNavigate()
  const [garages, setGarages] = useState([])
  const [etat, setEtat] = useState(() => (lire(CLE_PAUSE, '') > aujourdhui() ? 'pause' : 'question')) // question | merci | pause
  const [envoi, setEnvoi] = useState(false)
  const [saisie, setSaisie] = useState('')
  const [environ, setEnviron] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    chargerGarages().then(setGarages).catch(() => {})
  }, [])

  const questions = questionsEnAttente(voitures, garages)
  const qn = questions[0]

  if (etat === 'pause' || (!qn && etat !== 'merci')) return null

  const pause = () => {
    ecrire(CLE_PAUSE, ajouterJours(aujourdhui(), 1))
    setEtat('pause')
  }

  if (etat === 'merci')
    return (
      <Carte className="flex items-center justify-between gap-3 bg-emerald-50">
        <p className="font-medium text-emerald-800">{qn ? '✓ Merci ! Une autre ?' : '✓ Merci, tout est à jour.'}</p>
        {qn ? (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setEtat('question')} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
              Oui
            </button>
            <button onClick={pause} className="rounded-xl px-3 py-2 text-sm text-emerald-800">
              À demain
            </button>
          </div>
        ) : (
          <button onClick={pause} className="text-sm text-emerald-800">
            OK
          </button>
        )}
      </Carte>
    )

  const v = qn.voiture

  async function repondre(action) {
    setErreur(null)
    setEnvoi(true)
    try {
      await action()
      setSaisie('')
      await recharger()
      setEtat('merci')
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnvoi(false)
    }
  }

  const jeNeSaisPas = () =>
    repondre(() => q(supabase.from('vehicles').update({ inconnus: [...new Set([...(v.inconnus ?? []), qn.cle])] }).eq('id', v.id)))

  function plusTard(jours = 7) {
    ecrire(CLE_REPORTS, { ...lire(CLE_REPORTS, {}), [qn.id]: ajouterJours(aujourdhui(), jours) })
    setSaisie('')
    setEtat('question')
    recharger() // la question suivante prend la place
  }

  const date = (type, mois) =>
    repondre(() =>
      q(supabase.from('events').insert({ vehicle_id: v.id, type, date: ilYa(mois), date_approx: true, note: 'Réponse rapide' })),
    )

  const bouton = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium active:bg-slate-100 disabled:opacity-50'

  // « c'est fait ? » et saison : les réponses sont dans les boutons, pas de « je ne sais pas »
  const sansPied = qn.cle.startsWith('fait_') || qn.cle === 'saison'
  const boutonPrincipal = 'rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-50'

  let titre
  let corps
  switch (qn.cle) {
    case 'fait_revision':
    case 'fait_ct': {
      const type = qn.cle === 'fait_ct' ? 'controle_technique' : 'revision'
      titre = qn.cle === 'fait_ct' ? `Le contrôle technique de la ${nom(v)}, c’est fait ?` : `La révision de la ${nom(v)}, c’est faite ?`
      corps = (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={envoi} onClick={() => navigate(`/papier?voiture=${v.id}&type=${type}`)} className={boutonPrincipal}>
            📷 Oui, j’ai le papier
          </button>
          <button
            disabled={envoi}
            onClick={() =>
              repondre(async () => {
                await q(supabase.from('events').insert({ vehicle_id: v.id, type, date: aujourdhui(), date_approx: true, note: 'Réponse rapide : c’est fait' }))
                if (type === 'controle_technique') await q(supabase.from('vehicles').update({ prochain_ct: null }).eq('id', v.id))
              })
            }
            className={bouton}
          >
            Oui, sans papier
          </button>
          <button disabled={envoi} onClick={() => plusTard(14)} className={`${bouton} col-span-2`}>
            Pas encore
          </button>
        </div>
      )
      break
    }
    case 'fait_assurance':
      titre = `L’assurance de la ${nom(v)} a été renouvelée ?`
      corps = (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={envoi} onClick={() => navigate(`/papier?voiture=${v.id}&sorte=assurance`)} className={boutonPrincipal}>
            📷 Nouvelle attestation
          </button>
          <button
            disabled={envoi}
            onClick={() =>
              repondre(async () => {
                let echeance = v.echeance_assurance
                while (joursAvant(echeance) < 0) echeance = ajouterMois(echeance, 12)
                await q(supabase.from('vehicles').update({ echeance_assurance: echeance }).eq('id', v.id))
                await info(v.id, 'a indiqué que l’assurance est renouvelée')
              })
            }
            className={bouton}
          >
            Oui, reconduite
          </button>
          <button disabled={envoi} onClick={() => plusTard(14)} className={`${bouton} col-span-2`}>
            Pas encore
          </button>
        </div>
      )
      break
    case 'saison': {
      const cible = saisonCible()
      titre = `Pneus ${cible === 'hiver' ? 'hiver' : 'été'} montés sur la ${nom(v)} ?`
      corps = (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={envoi} onClick={() => repondre(() => passerALaSaison(v, v.jeux, cible))} className={boutonPrincipal}>
            {cible === 'hiver' ? '❄️' : '☀️'} Oui, c’est fait
          </button>
          <button disabled={envoi} onClick={() => plusTard(7)} className={bouton}>
            Pas encore
          </button>
        </div>
      )
      break
    }
    case 'km':
      titre = `Combien de km au compteur de la ${nom(v)}\u00a0?`
      corps = (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const km = parseInt(saisie, 10)
            if (km) repondre(() => q(supabase.from('mileage_readings').insert({ vehicle_id: v.id, km, km_approx: environ })))
          }}
        >
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              placeholder="Ex. 85000"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value.replace(/\D/g, ''))}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2"
            />
            <button disabled={!saisie || envoi} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
              OK
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={environ} onChange={(e) => setEnviron(e.target.checked)} className="h-4 w-4" />
            environ, à vue de nez
          </label>
        </form>
      )
      break
    case 'revision':
    case 'ct': {
      const type = qn.cle === 'ct' ? 'controle_technique' : 'revision'
      titre = qn.cle === 'ct' ? `Dernier contrôle technique de la ${nom(v)}\u00a0?` : `Dernière révision de la ${nom(v)}\u00a0?`
      corps = (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {IL_Y_A.map((r) => (
              <button key={r.mois} disabled={envoi} onClick={() => date(type, r.mois)} className={bouton}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={() => navigate(`/ajout?voiture=${v.id}&type=${type}`)} className="text-sm text-sky-600">
            J’ai la date exacte ou la facture
          </button>
        </div>
      )
      break
    }
    case 'assurance':
      titre = `Assurance de la ${nom(v)}`
      corps = (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Une photo de l’attestation (ou le PDF reçu par mail) et tout se remplit.</p>
          <button onClick={() => navigate(`/voiture/${v.id}/modifier?section=assurance`)} className={`${bouton} w-full`}>
            📷 Attestation d’assurance
          </button>
        </div>
      )
      break
    case 'pneus':
      titre = `Dimension des pneus de la ${nom(v)}\u00a0?`
      corps = (
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault()
            const dim = saisie.toUpperCase().replace(/\s+/g, ' ').trim()
            if (dim)
              repondre(async () => {
                await q(supabase.from('vehicles').update({ dimension_pneus: dim }).eq('id', v.id))
                await info(v.id, `a renseigné la dimension des pneus (${dim})`)
              })
          }}
        >
          <div className="flex gap-2">
            <input
              placeholder="205/55 R16 91V"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 font-mono uppercase"
            />
            <button disabled={!saisie.trim() || envoi} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40">
              OK
            </button>
          </div>
          <p className="text-xs text-slate-500">Inscrite sur le flanc du pneu.</p>
        </form>
      )
      break
    case 'jeu_pneus':
      titre = `Quels pneus sont montés sur la ${nom(v)}\u00a0?`
      corps = (
        <div className="grid grid-cols-3 gap-2">
          {['ete', 'hiver', '4saisons'].map((s) => (
            <button
              key={s}
              disabled={envoi}
              onClick={() =>
                repondre(async () => {
                  await q(supabase.from('tyre_sets').insert({ vehicle_id: v.id, saison: s, statut: 'monte', etat: 'inconnu' }))
                  await info(v.id, `a indiqué les pneus montés (${SAISONS[s].toLowerCase()})`)
                })
              }
              className={`${bouton} flex flex-col items-center gap-1 py-3`}
            >
              <span className="text-2xl">{{ ete: '☀️', hiver: '❄️', '4saisons': '🌤️' }[s]}</span>
              {SAISONS[s]}
            </button>
          ))}
        </div>
      )
      break
    case 'garage':
      titre = `Garage habituel de la ${nom(v)}\u00a0?`
      corps = (
        <div className="flex flex-wrap gap-2">
          {garages.map((g) => (
            <button
              key={g.id}
              disabled={envoi}
              onClick={() =>
                repondre(async () => {
                  await q(supabase.from('vehicles').update({ garage_habituel_id: g.id }).eq('id', v.id))
                  await info(v.id, `a indiqué le garage habituel (${g.nom})`)
                })
              }
              className={bouton}
            >
              {g.nom}
            </button>
          ))}
          <button disabled={envoi} onClick={jeNeSaisPas} className={bouton}>
            Pas de garage attitré
          </button>
        </div>
      )
      break
    default:
      return null
  }

  return (
    <Carte className="space-y-3 border-2 border-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question rapide</p>
          <p className="font-semibold">{titre}</p>
        </div>
        <button onClick={pause} className="shrink-0 text-xs text-slate-400" aria-label="Pas aujourd’hui">
          Pas aujourd’hui ✕
        </button>
      </div>
      {corps}
      {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      {!sansPied && <div className="flex gap-4 text-sm">
        <button disabled={envoi} onClick={jeNeSaisPas} className="font-medium text-slate-700">
          Je ne sais pas
        </button>
        <button disabled={envoi} onClick={() => plusTard()} className="text-slate-500">
          Plus tard
        </button>
      </div>}
    </Carte>
  )
}
