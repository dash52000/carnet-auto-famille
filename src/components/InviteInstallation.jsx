import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { estIOS, estStandalone, invitationMasquee, masquerInvitation, memoriserCode } from '../lib/installation.js'
import GuideInstallation from './GuideInstallation.jsx'
import { Carte } from './ui.jsx'

/** Sur l'accueil, tant que l'app n'est pas ouverte depuis l'écran d'accueil. */
export default function InviteInstallation() {
  const [ouvert, setOuvert] = useState(false)
  const [masquee, setMasquee] = useState(invitationMasquee())

  // l'app installée sur iPhone reçoit les cookies de Safari : le code famille y sera déjà rempli
  useEffect(() => {
    if (estIOS() && !estStandalone())
      supabase.rpc('code_famille').then(({ data }) => data && memoriserCode(data))
  }, [])

  if (estStandalone()) return null

  if (masquee && !ouvert)
    return (
      <button onClick={() => setOuvert(true)} className="block w-full text-center text-sm text-slate-500 underline">
        📲 Installer l’app sur l’écran d’accueil
      </button>
    )

  return (
    <Carte className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">📲 Installe l’app sur ton écran d’accueil</p>
          <p className="text-sm text-slate-600">Elle s’ouvre en un geste, comme une vraie appli.</p>
        </div>
        <button
          onClick={() => {
            masquerInvitation()
            setMasquee(true)
            setOuvert(false)
          }}
          className="shrink-0 text-xs text-slate-400"
        >
          Plus tard ✕
        </button>
      </div>
      {ouvert || !estIOS() ? (
        <>
          <GuideInstallation />
          {estIOS() && (
            <p className="text-xs text-slate-500">Dans l’app installée, ton prénom te sera redemandé une seule fois (c’est l’iPhone qui sépare les deux).</p>
          )}
        </>
      ) : (
        <button onClick={() => setOuvert(true)} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white">
          Me montrer comment
        </button>
      )}
    </Carte>
  )
}
