import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { chargerGarages, creerVoiture } from '../lib/donnees.js'
import { envoyerFichier } from '../lib/images.js'
import { normaliserPlaque } from '../lib/format.js'
import { Bouton, Carte, Champ, Chargement, Erreur, Input, classeInput } from '../components/ui.jsx'

const VIDE = {
  plaque: '',
  marque: '',
  modele: '',
  date_1re_immat: '',
  vin: '',
  type_mine: '',
  dimension_pneus: '',
  alterne_saisons: false,
  intervalle_revision_mois: 12,
  intervalle_revision_km: 15000,
  prochain_ct: '',
  assureur: '',
  numero_contrat: '',
  tel_assistance: '',
  echeance_assurance: '',
  garage_habituel_id: '',
}

export default function FormVoiture() {
  const { id } = useParams()
  const navigate = useNavigate()
  const edition = Boolean(id)
  const [v, setV] = useState(VIDE)
  const [debut, setDebut] = useState({ km: '', revision_date: '', revision_km: '', ct_date: '' })
  const [carteGrise, setCarteGrise] = useState(null)
  const [garages, setGarages] = useState([])
  const [chargement, setChargement] = useState(edition)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    chargerGarages().then(setGarages).catch(() => {})
    if (!edition) return
    supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setErreur(error.message)
        else setV(Object.fromEntries(Object.keys(VIDE).map((k) => [k, data[k] ?? VIDE[k]])))
        setChargement(false)
      })
  }, [id, edition])

  const maj = (champ) => (e) => setV({ ...v, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const majDebut = (champ) => (e) => setDebut({ ...debut, [champ]: e.target.value })

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      // les champs vides deviennent null
      const champs = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? null : val]))
      champs.plaque = normaliserPlaque(v.plaque)
      champs.intervalle_revision_mois = parseInt(v.intervalle_revision_mois, 10) || 12
      champs.intervalle_revision_km = parseInt(v.intervalle_revision_km, 10) || 15000

      if (edition) {
        await q(supabase.from('vehicles').update(champs).eq('id', id))
        navigate(`/voiture/${id}`, { replace: true })
        return
      }

      const nouvelId = await creerVoiture(champs)
      const inserts = []
      if (debut.km) inserts.push(supabase.from('mileage_readings').insert({ vehicle_id: nouvelId, km: parseInt(debut.km, 10) }))
      if (debut.revision_date)
        inserts.push(
          supabase.from('events').insert({
            vehicle_id: nouvelId,
            type: 'revision',
            date: debut.revision_date,
            km: debut.revision_km ? parseInt(debut.revision_km, 10) : null,
            note: 'Saisie à la création de la voiture',
          }),
        )
      if (debut.ct_date)
        inserts.push(
          supabase.from('events').insert({
            vehicle_id: nouvelId,
            type: 'controle_technique',
            date: debut.ct_date,
            note: 'Saisie à la création de la voiture',
          }),
        )
      await Promise.all(inserts)
      if (carteGrise) {
        const chemin = await envoyerFichier(nouvelId, carteGrise)
        await q(supabase.from('documents').insert({ vehicle_id: nouvelId, type: 'carte_grise', fichier_path: chemin, nom: 'Carte grise' }))
      }
      navigate(`/voiture/${nouvelId}`, { replace: true })
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) return <Chargement />

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <h2 className="text-lg font-semibold">{edition ? 'Modifier la voiture' : 'Nouvelle voiture'}</h2>

      <Carte className="space-y-3">
        <h3 className="font-semibold">Carte grise</h3>
        {!edition && (
          <Champ label="Photo de la carte grise (facultatif)" aide="Rangée dans les documents. La lecture automatique arrivera en V2.">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setCarteGrise(e.target.files[0])} />
          </Champ>
        )}
        <Champ label="Plaque (A) *">
          <Input required value={v.plaque} onChange={maj('plaque')} placeholder="AB-123-CD" className="uppercase" />
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Marque (D.1)">
            <Input value={v.marque} onChange={maj('marque')} />
          </Champ>
          <Champ label="Modèle (D.3)">
            <Input value={v.modele} onChange={maj('modele')} />
          </Champ>
        </div>
        <Champ label="1re immatriculation (B)">
          <Input type="date" value={v.date_1re_immat} onChange={maj('date_1re_immat')} />
        </Champ>
        <Champ label="VIN (E)">
          <Input value={v.vin} onChange={maj('vin')} className="font-mono uppercase" />
        </Champ>
        <Champ label="Type mine / CNIT (D.2.1)" aide="Sert à trouver les bonnes pièces sur les sites spécialisés.">
          <Input value={v.type_mine} onChange={maj('type_mine')} className="font-mono uppercase" />
        </Champ>
      </Carte>

      {!edition && (
        <Carte className="space-y-3">
          <h3 className="font-semibold">Pour démarrer</h3>
          <Champ label="Kilométrage actuel">
            <Input inputMode="numeric" value={debut.km} onChange={majDebut('km')} />
          </Champ>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Dernière révision">
              <Input type="date" value={debut.revision_date} onChange={majDebut('revision_date')} />
            </Champ>
            <Champ label="à (km)">
              <Input inputMode="numeric" value={debut.revision_km} onChange={majDebut('revision_km')} />
            </Champ>
          </div>
          <Champ label="Dernier contrôle technique">
            <Input type="date" value={debut.ct_date} onChange={majDebut('ct_date')} />
          </Champ>
        </Carte>
      )}

      <Carte className="space-y-3">
        <h3 className="font-semibold">Entretien</h3>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Révision tous les (mois)">
            <Input inputMode="numeric" value={v.intervalle_revision_mois} onChange={maj('intervalle_revision_mois')} />
          </Champ>
          <Champ label="ou tous les (km)">
            <Input inputMode="numeric" value={v.intervalle_revision_km} onChange={maj('intervalle_revision_km')} />
          </Champ>
        </div>
        <Champ label="Prochain CT (si différent du calcul automatique)">
          <Input type="date" value={v.prochain_ct ?? ''} onChange={maj('prochain_ct')} />
        </Champ>
        <Champ label="Garage habituel">
          <select value={v.garage_habituel_id ?? ''} onChange={maj('garage_habituel_id')} className={classeInput}>
            <option value="">—</option>
            {garages.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom}
              </option>
            ))}
          </select>
        </Champ>
      </Carte>

      <Carte className="space-y-3">
        <h3 className="font-semibold">Pneus</h3>
        <Champ label="Dimension" aide="Inscrite sur le flanc du pneu, ex. 205/55 R16 91V">
          <Input value={v.dimension_pneus} onChange={maj('dimension_pneus')} className="uppercase" />
        </Champ>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={v.alterne_saisons} onChange={maj('alterne_saisons')} className="h-5 w-5" />
          Alterne pneus été / hiver
        </label>
      </Carte>

      <Carte className="space-y-3">
        <h3 className="font-semibold">Assurance</h3>
        <Champ label="Assureur">
          <Input value={v.assureur} onChange={maj('assureur')} />
        </Champ>
        <Champ label="N° de contrat">
          <Input value={v.numero_contrat} onChange={maj('numero_contrat')} />
        </Champ>
        <Champ label="Téléphone assistance / dépannage">
          <Input type="tel" value={v.tel_assistance} onChange={maj('tel_assistance')} />
        </Champ>
        <Champ label="Échéance du contrat">
          <Input type="date" value={v.echeance_assurance ?? ''} onChange={maj('echeance_assurance')} />
        </Champ>
      </Carte>

      <Erreur message={erreur} />
      <div className="flex gap-3">
        <Bouton type="button" variante="secondaire" className="flex-1" onClick={() => navigate(-1)}>
          Annuler
        </Bouton>
        <Bouton className="flex-1" disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </div>
    </form>
  )
}
