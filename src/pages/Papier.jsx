import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, q } from '../lib/supabase.js'
import { chargerGarages } from '../lib/donnees.js'
import { lireTexte } from '../lib/ocr.js'
import { analyserPapier } from '../lib/analyse.js'
import {
  deposerATrier,
  derniereVoiture,
  enregistrerAssurance,
  enregistrerIntervention,
  lectureSure,
  resumeLecture,
  retenirVoiture,
} from '../lib/papiers.js'
import { Bouton, Carte, Chargement, Erreur } from '../components/ui.jsx'

const nomVoiture = (v) => [v.marque, v.modele].filter(Boolean).join(' ') || 'Modèle ?'

/**
 * « J'ai un papier » : on photographie, c'est tout.
 * Lecture sûre → une ligne à confirmer ; sinon le papier part dans la pile « À trier » (l'admin complète).
 * Paramètres facultatifs : ?voiture=<id>&type=<intervention>&sorte=assurance
 */
export default function Papier() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [voitures, setVoitures] = useState(null)
  const [garages, setGarages] = useState([])
  const [etape, setEtape] = useState('photo') // photo | lecture | voiture | confirmer | envoi | merci | fini
  const [progres, setProgres] = useState(0)
  const [fichier, setFichier] = useState(null)
  const [apercu, setApercu] = useState(null)
  const [analyse, setAnalyse] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    q(supabase.from('vehicles').select('id, plaque, marque, modele, km_actuel').eq('archivee', false).order('created_at'))
      .then(setVoitures)
      .catch((e) => setErreur(e.message))
    chargerGarages().then(setGarages).catch(() => {})
  }, [])
  useEffect(() => () => apercu && URL.revokeObjectURL(apercu), [apercu])

  if (!voitures) return erreur ? <Erreur message={erreur} /> : <Chargement />

  const voitureImposee = voitures.find((v) => v.id === params.get('voiture'))
  const typeImpose = params.get('type')
  const sorteImposee = params.get('sorte') || (typeImpose === 'controle_technique' ? 'ct' : typeImpose ? 'facture' : null)

  async function choisi(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErreur(null)
    setFichier(f)
    setApercu(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    setProgres(0)
    setEtape('lecture')
    let texte = ''
    try {
      texte = await lireTexte(f, setProgres)
    } catch {
      /* lecture impossible : le papier ira dans la pile « À trier » */
    }
    const a = analyserPapier(texte, { garages, voitures, sorte: sorteImposee })
    if (voitureImposee) a.vehicle_id = voitureImposee.id
    if (typeImpose) a.type = typeImpose
    if (!a.vehicle_id && voitures.length === 1) a.vehicle_id = voitures[0].id
    setAnalyse(a)
    if (!a.vehicle_id) setEtape('voiture')
    else suite(a, f)
  }

  /** Voiture connue : confirmation en une ligne si la lecture est sûre, sinon « À trier ». */
  function suite(a, f = fichier) {
    if (lectureSure(a)) setEtape('confirmer')
    else aTrier(a, f)
  }

  async function aTrier(a = analyse, f = fichier) {
    setEtape('envoi')
    try {
      await deposerATrier({ fichier: f, analyse: a })
      retenirVoiture(a.vehicle_id)
      setEtape('merci')
    } catch (err) {
      setErreur(`Envoi impossible (${err.message}). Vérifie le réseau et réessaie.`)
      setEtape('photo')
    }
  }

  async function confirmer() {
    setEtape('envoi')
    const voiture = voitures.find((v) => v.id === analyse.vehicle_id)
    try {
      if (analyse.sorte === 'assurance') await enregistrerAssurance({ voiture, champs: analyse.champs, fichier })
      else await enregistrerIntervention({ voiture, type: analyse.type, champs: analyse.champs, fichier })
      retenirVoiture(voiture.id)
      setEtape('fini')
    } catch (err) {
      setErreur(`Enregistrement impossible (${err.message}). Réessaie.`)
      setEtape('confirmer')
    }
  }

  const recommencer = () => {
    setFichier(null)
    setApercu(null)
    setAnalyse(null)
    setErreur(null)
    setEtape('photo')
  }

  const voiture = analyse && voitures.find((v) => v.id === analyse.vehicle_id)

  if (etape === 'photo')
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">📷 J'ai un papier</h2>
          <p className="text-slate-600">
            Facture de garage, contrôle technique ou attestation d'assurance
            {voitureImposee ? (
              <>
                {' '}
                pour la <b>{nomVoiture(voitureImposee)}</b>
              </>
            ) : null}
            . Prends-le en photo, c'est tout.
          </p>
        </div>
        <Erreur message={erreur} />
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl bg-slate-900 px-4 py-10 text-white active:bg-slate-700">
          <span className="text-5xl">📷</span>
          <span className="text-lg font-semibold">Prendre en photo</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={choisi} />
        </label>
        <label className="block cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-700 active:bg-slate-100">
          Choisir une photo ou un PDF
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={choisi} />
        </label>
        <p className="text-center text-xs text-slate-500">Bien à plat, sans reflet. La photo ne sert qu'à la famille.</p>
      </div>
    )

  if (etape === 'lecture' || etape === 'envoi')
    return (
      <Carte className="space-y-3 text-center">
        {apercu && <img src={apercu} alt="" className="mx-auto max-h-48 rounded-xl object-contain" />}
        <p className="font-medium">{etape === 'lecture' ? 'Je lis le papier…' : 'Envoi…'}</p>
        {etape === 'lecture' && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${Math.round(progres * 100)}%` }} />
          </div>
        )}
      </Carte>
    )

  if (etape === 'voiture') {
    const derniere = derniereVoiture()
    const triees = [...voitures].sort((a, b) => (b.id === derniere) - (a.id === derniere))
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">C'est pour quelle voiture ?</h2>
        {triees.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              const a = { ...analyse, vehicle_id: v.id }
              setAnalyse(a)
              suite(a)
            }}
            className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm active:bg-slate-100 ${v.id === derniere ? 'ring-2 ring-slate-900' : ''}`}
          >
            <span className="rounded-md border-2 border-slate-800 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{v.plaque}</span>
            <span className="text-slate-700">{nomVoiture(v)}</span>
          </button>
        ))}
        <button onClick={() => aTrier({ ...analyse, vehicle_id: null })} className="w-full py-2 text-slate-600 underline">
          Je ne sais pas
        </button>
      </div>
    )
  }

  if (etape === 'confirmer')
    return (
      <div className="space-y-4">
        <Carte className="space-y-3">
          {apercu && <img src={apercu} alt="" className="mx-auto max-h-40 rounded-xl object-contain" />}
          <p className="text-sm text-slate-500">
            <span className="font-mono font-bold text-slate-800">{voiture.plaque}</span> {nomVoiture(voiture)}
          </p>
          <p className="text-lg font-semibold">{resumeLecture(analyse)}</p>
          {analyse.champs.contre_visite && (
            <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">Contre-visite à faire : l'échéance du CT sera mise à jour.</p>
          )}
          <p className="font-medium">C'est bon ?</p>
        </Carte>
        <Erreur message={erreur} />
        <div className="flex gap-3">
          <Bouton variante="secondaire" className="flex-1" onClick={() => aTrier()}>
            Pas tout à fait
          </Bouton>
          <Bouton className="flex-1" onClick={confirmer}>
            Oui
          </Bouton>
        </div>
      </div>
    )

  // merci (pile « À trier ») ou fini (enregistré)
  return (
    <div className="space-y-4">
      <Carte className="space-y-2 bg-emerald-50 text-center">
        <p className="text-4xl">✓</p>
        <p className="text-lg font-semibold text-emerald-900">{etape === 'fini' ? 'C’est enregistré !' : 'Merci, c’est noté !'}</p>
        <p className="text-sm text-emerald-800">
          {etape === 'fini'
            ? `${resumeLecture(analyse)} — sur la ${nomVoiture(voiture)}.`
            : 'Le papier est mis de côté, il sera complété. Tu n’as rien d’autre à faire.'}
        </p>
      </Carte>
      <div className="flex gap-3">
        <Bouton variante="secondaire" className="flex-1" onClick={recommencer}>
          Un autre papier
        </Bouton>
        <Bouton className="flex-1" onClick={() => navigate('/', { replace: true })}>
          Terminé
        </Bouton>
      </div>
      {etape === 'fini' && voiture && (
        <Link to={`/voiture/${voiture.id}?onglet=historique`} className="block text-center text-sm text-sky-600">
          Voir l'historique de la voiture
        </Link>
      )}
    </div>
  )
}
