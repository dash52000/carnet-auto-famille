import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { chargerGarages } from '../lib/donnees.js'
import { envoyerFichier } from '../lib/images.js'
import { TYPES_INTERVENTION } from '../lib/constantes.js'
import { aujourdhui, fmtDate } from '../lib/format.js'
import { analyserFacture, analyserPV } from '../lib/analyse.js'
import LecturePapier, { classeLu } from '../components/LecturePapier.jsx'
import { Bouton, Carte, Champ, Chargement, Erreur, Input, classeInput } from '../components/ui.jsx'

export default function Ajout() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [voitures, setVoitures] = useState(null)
  const [voitureId, setVoitureId] = useState(params.get('voiture'))
  const [type, setType] = useState(() => TYPES_INTERVENTION.find((t) => t.code === params.get('type')) ?? null)

  useEffect(() => {
    q(supabase.from('vehicles').select('id, plaque, marque, modele, km_actuel, garage_habituel_id').eq('archivee', false).order('created_at'))
      .then((liste) => {
        setVoitures(liste)
        if (liste.length === 1) setVoitureId((id) => id ?? liste[0].id)
      })
      .catch(() => setVoitures([]))
  }, [])

  if (!voitures) return <Chargement />
  if (voitures.length === 0)
    return (
      <Carte className="text-center">
        Ajoute d'abord une voiture.
        <Bouton className="mt-3 w-full" onClick={() => navigate('/voiture/nouvelle')}>
          Ajouter une voiture
        </Bouton>
      </Carte>
    )

  const voiture = voitures.find((v) => v.id === voitureId)

  // Étape 1 : quelle voiture ?
  if (!voiture)
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Quelle voiture ?</h2>
        {voitures.map((v) => (
          <button key={v.id} onClick={() => setVoitureId(v.id)} className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm">
            <span className="font-mono font-bold">{v.plaque}</span>{' '}
            <span className="text-slate-600">{[v.marque, v.modele].filter(Boolean).join(' ')}</span>
          </button>
        ))}
      </div>
    )

  // Étape 2 : qu'est-ce qui a été fait ?
  if (!type)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Qu'est-ce qui a été fait ?</h2>
          {voitures.length > 1 && (
            <button className="font-mono text-sm font-bold text-sky-600" onClick={() => setVoitureId(null)}>
              {voiture.plaque} ▾
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TYPES_INTERVENTION.map((t) => (
            <button
              key={t.code}
              onClick={() => setType(t)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-white p-2 text-center text-sm font-medium shadow-sm active:bg-slate-100"
            >
              <span className="text-3xl">{t.icone}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    )

  return <FormIntervention voiture={voiture} type={type} onRetour={() => setType(null)} />
}

function FormIntervention({ voiture, type, onRetour }) {
  const navigate = useNavigate()
  const [garages, setGarages] = useState([])
  const [f, setF] = useState({
    date: aujourdhui(),
    km: voiture.km_actuel ?? '',
    cout: '',
    garage_id: voiture.garage_habituel_id ?? '',
    libelle: '',
    note: '',
    reference: '',
    marque_piece: '',
  })
  const [facture, setFacture] = useState(null)
  const [lus, setLus] = useState({})
  const [contreVisite, setContreVisite] = useState(null) // date limite lue sur le PV
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    chargerGarages().then(setGarages).catch(() => {})
    // dernier garage utilisé pour cette voiture
    supabase
      .from('events')
      .select('garage_id')
      .eq('vehicle_id', voiture.id)
      .not('garage_id', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setF((s) => ({ ...s, garage_id: s.garage_id || data[0].garage_id }))
      })
    // référence déjà connue pour cette pièce : souvent la même, il suffit de confirmer
    if (type.piece) {
      let requete = supabase.from('parts').select('reference, marque').eq('vehicle_id', voiture.id).eq('categorie', type.piece.categorie)
      requete = type.piece.position ? requete.eq('position', type.piece.position) : requete.is('position', null)
      requete.limit(1).then(({ data }) => {
        if (data?.[0]) setF((s) => ({ ...s, reference: s.reference || data[0].reference || '', marque_piece: s.marque_piece || data[0].marque || '' }))
      })
    }
  }, [voiture.id, type.piece])

  const maj = (champ) => (e) => setF({ ...f, [champ]: e.target.value })

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const eventId = crypto.randomUUID()
      await q(
        supabase.from('events').insert({
          id: eventId,
          vehicle_id: voiture.id,
          type: type.code,
          date: f.date,
          km: f.km === '' ? null : parseInt(f.km, 10),
          cout: f.cout === '' ? null : Number(String(f.cout).replace(',', '.')),
          garage_id: f.garage_id || null,
          libelle: f.libelle || null,
          note: f.note || null,
        }),
      )
      if (facture) {
        const chemin = await envoyerFichier(voiture.id, facture)
        const ct = type.code === 'controle_technique'
        await q(
          supabase.from('documents').insert({
            vehicle_id: voiture.id,
            event_id: eventId,
            type: ct ? 'controle_technique' : 'facture',
            fichier_path: chemin,
            nom: ct ? 'PV de contrôle technique' : `Facture ${type.label}`,
          }),
        )
      }
      // Le CT saisi remplace une éventuelle date forcée ; une contre-visite impose sa date limite
      if (type.code === 'controle_technique')
        await supabase.from('vehicles').update({ prochain_ct: contreVisite || null }).eq('id', voiture.id)
      // Référence de la pièce montée → fiche pièces
      if (type.piece && (f.reference || f.marque_piece)) {
        const { categorie, position } = type.piece
        let requete = supabase.from('parts').select('id').eq('vehicle_id', voiture.id).eq('categorie', categorie)
        requete = position ? requete.eq('position', position) : requete.is('position', null)
        const existantes = await q(requete)
        const champs = {
          reference: f.reference || null,
          marque: f.marque_piece || null,
          source: 'manuel',
          event_id: eventId,
          date_maj: new Date().toISOString(),
        }
        if (existantes.length) await q(supabase.from('parts').update(champs).eq('id', existantes[0].id))
        else await q(supabase.from('parts').insert({ vehicle_id: voiture.id, categorie, position, ...champs }))
      }
      navigate(`/voiture/${voiture.id}?onglet=historique`, { replace: true })
    } catch (err) {
      setErreur(err.message)
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onRetour} className="text-2xl" aria-label="Retour">
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {type.icone} {type.label} · <span className="font-mono">{voiture.plaque}</span>
        </h2>
      </div>

      <LecturePapier
        label={type.code === 'controle_technique' ? 'Photo du PV de contrôle' : 'Photo de la facture'}
        aide="Ou le PDF : date, km, montant et garage se remplissent"
        attendus={2}
        analyser={(texte) => (type.code === 'controle_technique' ? analyserPV(texte, garages) : analyserFacture(texte, garages))}
        onLu={(fichier, champs) => {
          setFacture(fichier)
          const { contre_visite, date_limite, ...valeurs } = champs
          setF((s) => ({
            ...s,
            ...valeurs,
            note: contre_visite && date_limite ? `Contre-visite à faire avant le ${fmtDate(date_limite)}` : s.note,
          }))
          setLus(valeurs)
          setContreVisite(contre_visite && date_limite ? date_limite : null)
        }}
      />

      <Carte className="space-y-3">
        {type.code === 'autre' && (
          <Champ label="Quoi ?">
            <Input required value={f.libelle} onChange={maj('libelle')} placeholder="Ex. ampoule feu stop" />
          </Champ>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Date">
            <Input type="date" required value={f.date} onChange={maj('date')} className={classeLu(lus, 'date')} />
          </Champ>
          <Champ label="Km">
            <Input
              inputMode="numeric"
              required
              value={f.km}
              onChange={(e) => setF({ ...f, km: e.target.value.replace(/\D/g, '') })}
              className={classeLu(lus, 'km')}
            />
          </Champ>
        </div>
        {type.piece && (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Réf. de la pièce">
                <Input value={f.reference} onChange={maj('reference')} className="font-mono" placeholder="Sur la boîte" />
              </Champ>
              <Champ label="Marque">
                <Input value={f.marque_piece} onChange={maj('marque_piece')} placeholder="Bosch, Valeo…" />
              </Champ>
            </div>
            <p className="text-xs text-slate-500">Facultatif : la référence est retenue dans la fiche Pièces pour racheter la même.</p>
          </div>
        )}
      </Carte>

      <Carte className="space-y-3">
        <p className="text-sm font-medium text-slate-500">Facultatif</p>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Coût (€)">
            <Input inputMode="decimal" value={f.cout} onChange={maj('cout')} className={classeLu(lus, 'cout')} />
          </Champ>
          <Champ label="Garage">
            <select value={f.garage_id} onChange={maj('garage_id')} className={`${classeInput} ${classeLu(lus, 'garage_id')}`}>
              <option value="">— Moi-même —</option>
              {garages.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
          </Champ>
        </div>
        {type.code !== 'autre' && (
          <Champ label="Précision">
            <Input value={f.libelle} onChange={maj('libelle')} placeholder={type.code === 'filtres' ? 'Ex. filtre à air + habitacle' : ''} />
          </Champ>
        )}
        <Champ label="Note">
          <textarea value={f.note} onChange={maj('note')} rows={2} className={classeInput} />
        </Champ>
      </Carte>

      <Erreur message={erreur} />
      <Bouton className="w-full" disabled={envoi}>
        {envoi ? 'Enregistrement…' : 'Enregistrer'}
      </Bouton>
    </form>
  )
}
