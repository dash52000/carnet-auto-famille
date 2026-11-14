import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { chargerGarages, creerVoiture } from '../lib/donnees.js'
import { envoyerFichier } from '../lib/images.js'
import { lireTexte } from '../lib/ocr.js'
import { analyserAttestation, analyserCarteGrise } from '../lib/analyse.js'
import LecturePapier, { classeLu } from '../components/LecturePapier.jsx'
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

const TITRES_SECTION = { entretien: 'Entretien', pneus: 'Pneus', assurance: 'Assurance' }

/** Les champs vides deviennent null, les nombres sont convertis. */
function preparerChamps(v) {
  const champs = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === '' ? null : val]))
  champs.plaque = normaliserPlaque(v.plaque)
  champs.vin = v.vin ? v.vin.toUpperCase().replace(/\s/g, '') : null
  champs.type_mine = v.type_mine ? v.type_mine.toUpperCase().replace(/\s/g, '') : null
  champs.intervalle_revision_mois = parseInt(v.intervalle_revision_mois, 10) || 12
  champs.intervalle_revision_km = parseInt(v.intervalle_revision_km, 10) || 15000
  return champs
}

export default function FormVoiture() {
  const { id } = useParams()
  return id ? <EditionVoiture id={id} /> : <NouvelleVoiture />
}

/** Champs de la carte grise ; ceux lus sur la photo sont surlignés en vert. */
function ChampsCarteGrise({ v, maj, lus = {} }) {
  const lu = (champ) => classeLu(lus, champ)
  return (
    <>
      <Champ label="Plaque (A) *">
        <Input required value={v.plaque} onChange={maj('plaque')} placeholder="AB-123-CD" className={`uppercase ${lu('plaque')}`} />
      </Champ>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Marque (D.1)">
          <Input value={v.marque} onChange={maj('marque')} className={lu('marque')} />
        </Champ>
        <Champ label="Modèle (D.3)">
          <Input value={v.modele} onChange={maj('modele')} className={lu('modele')} />
        </Champ>
      </div>
      <Champ label="1re immatriculation (B)">
        <Input type="date" value={v.date_1re_immat} onChange={maj('date_1re_immat')} className={lu('date_1re_immat')} />
      </Champ>
      <Champ label="VIN (E)">
        <Input value={v.vin} onChange={maj('vin')} className={`font-mono uppercase ${lu('vin')}`} />
      </Champ>
      <Champ label="Type mine / CNIT (D.2.1)" aide="Sert à trouver les bonnes pièces sur les sites spécialisés.">
        <Input value={v.type_mine} onChange={maj('type_mine')} className={`font-mono uppercase ${lu('type_mine')}`} />
      </Champ>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Création : photo de la carte grise → vérification → km → c'est fini */
/* ------------------------------------------------------------------ */

function NouvelleVoiture() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState('photo') // photo | lecture | verif
  const [v, setV] = useState(VIDE)
  const [km, setKm] = useState('')
  const [kmApprox, setKmApprox] = useState(false)
  const [carteGrise, setCarteGrise] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [progres, setProgres] = useState(0)
  const [lus, setLus] = useState({})
  const [message, setMessage] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => () => apercu && URL.revokeObjectURL(apercu), [apercu])

  const maj = (champ) => (e) => setV({ ...v, [champ]: e.target.value })

  async function photoChoisie(e) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setCarteGrise(fichier)
    setErreur(null)

    setApercu(fichier.type.startsWith('image/') ? URL.createObjectURL(fichier) : null)
    setProgres(0)
    setEtape('lecture')
    try {
      const champs = analyserCarteGrise(await lireTexte(fichier, setProgres))
      const n = Object.keys(champs).length
      setV((s) => ({ ...s, ...champs }))
      setLus(champs)
      setMessage(
        n >= 4
          ? { ok: true, texte: `${n} infos lues sur la carte grise : vérifie-les.` }
          : n > 0
            ? { ok: false, texte: `Seulement ${n} info${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''} : complète le reste (ou reprends une photo bien à plat, sans reflet).` }
            : { ok: false, texte: 'Rien de lisible sur la photo : reprends-la bien à plat, sans reflet, ou saisis à la main.' },
      )
    } catch {
      setMessage({ ok: false, texte: 'Lecture impossible (pas de réseau au premier scan ?). Saisis les infos à la main.' })
    }
    setEtape('verif')
  }

  async function creer(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const nouvelId = await creerVoiture(preparerChamps(v))
      if (km) await q(supabase.from('mileage_readings').insert({ vehicle_id: nouvelId, km: parseInt(km, 10), km_approx: kmApprox }))
      if (carteGrise) {
        const chemin = await envoyerFichier(nouvelId, carteGrise)
        await q(supabase.from('documents').insert({ vehicle_id: nouvelId, type: 'carte_grise', fichier_path: chemin, nom: 'Carte grise' }))
      }
      navigate(`/voiture/${nouvelId}`, { replace: true })
    } catch (err) {
      setErreur(err.message)
      setEnvoi(false)
    }
  }

  const boutonPhoto = (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-slate-900 px-4 py-8 text-center text-white active:bg-slate-700">
      <span className="text-4xl">📷</span>
      <span className="text-lg font-semibold">Photographier la carte grise</span>
      <span className="text-sm text-slate-300">Les infos sont lues automatiquement, tu n’as plus qu’à vérifier.</span>
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={photoChoisie} />
    </label>
  )

  if (etape === 'photo')
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Nouvelle voiture</h2>
        {boutonPhoto}
        <p className="text-center text-xs text-slate-500">
          Pose la carte bien à plat, sans reflet. La photo reste sur ton téléphone pour la lecture, puis est rangée dans les documents.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-medium">
            Choisir une photo ou un PDF déjà enregistré
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={photoChoisie} />
          </label>
          <Bouton variante="discret" onClick={() => setEtape('verif')}>
            Saisir à la main
          </Bouton>
        </div>
      </div>
    )

  if (etape === 'lecture')
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Nouvelle voiture</h2>
        <Carte className="space-y-3 text-center">
          {apercu && <img src={apercu} alt="Carte grise" className="mx-auto max-h-48 rounded-lg object-contain" />}
          <p className="font-medium">Lecture de la carte grise… {Math.round(progres * 100)} %</p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${Math.round(progres * 100)}%` }} />
          </div>
          {progres < 0.2 && <p className="text-xs text-slate-500">Le premier scan télécharge le moteur de lecture, ça peut prendre quelques secondes.</p>}
        </Carte>
      </div>
    )

  return (
    <form onSubmit={creer} className="space-y-4">
      <h2 className="text-lg font-semibold">Nouvelle voiture</h2>

      {message && (
        <p className={`rounded-xl p-3 text-sm ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          {message.ok ? '✓ ' : ''}
          {message.texte}
        </p>
      )}

      <Carte className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Carte grise</h3>
          <label className="cursor-pointer text-sm font-medium text-sky-600">
            {carteGrise ? '📷 Reprendre la photo' : '📷 Photo'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={photoChoisie} />
          </label>
        </div>
        <ChampsCarteGrise v={v} maj={maj} lus={lus} />
      </Carte>

      <Carte>
        <Champ label="Kilométrage actuel">
          <Input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} placeholder="Ex. 85000" />
        </Champ>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={kmApprox} onChange={(e) => setKmApprox(e.target.checked)} className="h-4 w-4" />
          environ (pas besoin d’aller vérifier au compteur)
        </label>
      </Carte>

      <p className="text-center text-xs text-slate-500">
        Le reste (révision, assurance, pneus…) te sera demandé petit à petit, une question rapide à la fois.
      </p>

      <Erreur message={erreur} />
      <div className="flex gap-3">
        <Bouton type="button" variante="secondaire" className="flex-1" onClick={() => navigate(-1)}>
          Annuler
        </Bouton>
        <Bouton className="flex-1" disabled={envoi}>
          {envoi ? 'Création…' : 'Créer la voiture'}
        </Bouton>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Modification : tout le formulaire, ou une seule section (?section=) */
/* ------------------------------------------------------------------ */

function EditionVoiture({ id }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const section = TITRES_SECTION[params.get('section')] ? params.get('section') : null
  const [v, setV] = useState(VIDE)
  const [garages, setGarages] = useState([])
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [attestation, setAttestation] = useState(null)
  const [lus, setLus] = useState({})

  useEffect(() => {
    chargerGarages().then(setGarages).catch(() => {})
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
  }, [id])

  const maj = (champ) => (e) => setV({ ...v, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const voir = (s) => !section || section === s

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      await q(supabase.from('vehicles').update(preparerChamps(v)).eq('id', id))
      if (attestation) {
        const chemin = await envoyerFichier(id, attestation)
        await q(supabase.from('documents').insert({ vehicle_id: id, type: 'assurance', fichier_path: chemin, nom: 'Attestation d’assurance' }))
      }
      navigate(`/voiture/${id}`, { replace: true })
    } catch (err) {
      setErreur(err.message)
      setEnvoi(false)
    }
  }

  if (chargement) return <Chargement />

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <h2 className="text-lg font-semibold">
        {section ? `${TITRES_SECTION[section]} · ` : 'Modifier '}
        <span className="font-mono">{v.plaque}</span>
      </h2>

      {!section && (
        <Carte className="space-y-3">
          <h3 className="font-semibold">Carte grise</h3>
          <ChampsCarteGrise v={v} maj={maj} />
        </Carte>
      )}

      {voir('entretien') && (
        <Carte className="space-y-3">
          {!section && <h3 className="font-semibold">Entretien</h3>}
          <Champ label="Garage habituel" aide={garages.length === 0 ? 'Ajoute d’abord tes garages dans le carnet de garages.' : undefined}>
            <select value={v.garage_habituel_id ?? ''} onChange={maj('garage_habituel_id')} className={classeInput}>
              <option value="">—</option>
              {garages.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
          </Champ>
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
        </Carte>
      )}

      {voir('pneus') && (
        <Carte className="space-y-3">
          {!section && <h3 className="font-semibold">Pneus</h3>}
          <Champ label="Dimension" aide="Inscrite sur le flanc du pneu, ex. 205/55 R16 91V">
            <Input value={v.dimension_pneus} onChange={maj('dimension_pneus')} className="uppercase" autoFocus={section === 'pneus'} />
          </Champ>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={v.alterne_saisons} onChange={maj('alterne_saisons')} className="h-5 w-5" />
            Alterne pneus été / hiver
          </label>
        </Carte>
      )}

      {voir('assurance') && (
        <Carte className="space-y-3">
          {!section && <h3 className="font-semibold">Assurance</h3>}
          <LecturePapier
            label="Attestation d’assurance"
            aide="Photo, ou le PDF reçu par mail : tout se remplit"
            analyser={analyserAttestation}
            onLu={(fichier, champs) => {
              setAttestation(fichier)
              setV((s) => ({ ...s, ...champs }))
              setLus(champs)
            }}
          />
          <Champ label="Assureur">
            <Input value={v.assureur} onChange={maj('assureur')} className={classeLu(lus, 'assureur')} />
          </Champ>
          <Champ label="Échéance du contrat">
            <Input type="date" value={v.echeance_assurance ?? ''} onChange={maj('echeance_assurance')} className={classeLu(lus, 'echeance_assurance')} />
          </Champ>
          <Champ label="Téléphone assistance / dépannage" aide="Utilisé par le bouton « Panne ».">
            <Input type="tel" value={v.tel_assistance} onChange={maj('tel_assistance')} className={classeLu(lus, 'tel_assistance')} />
          </Champ>
          <Champ label="N° de contrat">
            <Input value={v.numero_contrat} onChange={maj('numero_contrat')} className={classeLu(lus, 'numero_contrat')} />
          </Champ>
        </Carte>
      )}

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
