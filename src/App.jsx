import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { Chargement } from './components/ui.jsx'
import Layout from './components/Layout.jsx'
import Connexion from './pages/Connexion.jsx'
import Prenom from './pages/Prenom.jsx'
import Accueil from './pages/Accueil.jsx'
import FormVoiture from './pages/FormVoiture.jsx'
import Voiture from './pages/Voiture.jsx'
import Ajout from './pages/Ajout.jsx'
import Box from './pages/Box.jsx'
import Garages from './pages/Garages.jsx'
import Reglages from './pages/Reglages.jsx'
import Panne from './pages/Panne.jsx'
import Papier from './pages/Papier.jsx'
import ATrier from './pages/ATrier.jsx'

export default function App() {
  const { session, profil } = useAuth()

  if (session === undefined) return <Chargement />
  if (!session) return <Connexion />
  if (profil === undefined) return <Chargement />
  if (!profil || !profil.est_membre) return <Connexion />
  if (!profil.prenom) return <Prenom />

  return (
    <Routes>
      <Route path="/voiture/:id/panne" element={<Panne />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/voiture/nouvelle" element={<FormVoiture />} />
        <Route path="/voiture/:id" element={<Voiture />} />
        <Route path="/voiture/:id/modifier" element={<FormVoiture />} />
        <Route path="/ajout" element={<Ajout />} />
        <Route path="/papier" element={<Papier />} />
        <Route path="/a-trier" element={<ATrier />} />
        <Route path="/box" element={<Box />} />
        <Route path="/garages" element={<Garages />} />
        <Route path="/reglages" element={<Reglages />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
